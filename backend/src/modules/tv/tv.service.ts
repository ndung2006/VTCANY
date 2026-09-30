import { Injectable } from '@nestjs/common';
import { PlaybackService } from '../playback/playback.service';
import { EpgService } from '../content/epg.service';
import { mapEpgSchedule } from '../playback/aio-client';
import { TV_GROUPS, channelPublicId, epgDateWindow, groupForChannel } from './tv.catalog';

export interface TvChannelItem {
  public_id: string;
  name: string;
  logo: string | null;
  audio_only: boolean;
}

// Nguồn: kênh live AIO + lịch AIO, fallback lịch local CMS nhập tay.
// Postgres/Redis thay cache in-memory mà không đổi shape API.
@Injectable()
export class TvService {
  constructor(private playback: PlaybackService, private epgLocal: EpgService) {}

  async listGroups(): Promise<{ groups: Array<{ name: string; channels: TvChannelItem[] }> }> {
    const shells = new Map<string, TvChannelItem[]>(TV_GROUPS.map((g) => [g, []]));
    try {
      const res = await this.playback.listChannels();
      for (const c of res.channels) {
        const group = groupForChannel(c.name);
        shells.get(group)?.push({
          public_id: channelPublicId(c.name),
          name: c.name,
          logo: null,
          audio_only: !!c.audioOnly,
        });
      }
    } catch {
      // AIO lỗi -> trả khung nhóm rỗng để UI không vỡ.
    }
    return { groups: [...shells.entries()].map(([name, channels]) => ({ name, channels })) };
  }

  async resolveName(publicId: string): Promise<string> {
    if (!/^[0-9a-f]{24}$/.test(publicId)) {
      const err: any = new Error('invalid public_id (must be 24 hex chars)');
      err.status = 400;
      throw err;
    }
    try {
      const res = await this.playback.listChannels();
      const found = res.channels.find((c) => channelPublicId(c.name) === publicId);
      if (found) return found.name;
    } catch {
      // rơi xuống 404 bên dưới
    }
    const err: any = new Error('channel not found');
    err.status = 404;
    throw err;
  }

  async epg(publicId: string, date?: string) {
    const name = await this.resolveName(publicId);
    const today = new Date();
    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const day = date || todayIso;

    let hlsUrl: string | null = null;
    try {
      const t = await this.playback.mint(name);
      hlsUrl = t.hls_url;
    } catch {
      hlsUrl = null;
    }

    let timeline: Array<{ time: string; title: string; status: string }> = [];
    try {
      const raw = await this.playback.channelSchedule(name, day);
      if (raw) timeline = mapEpgSchedule(raw);
    } catch {
      timeline = [];
    }
    if (timeline.length === 0) {
      timeline = this.epgLocal.get(name, day).map((it) => ({ time: it.time, title: it.title, status: it.status }));
    }

    return {
      channel: { public_id: publicId, name, logo: null, hls_url: hlsUrl },
      epg_dates: epgDateWindow(today),
      timeline,
    };
  }

  // Luồng CMS (slug tên kênh, yêu cầu quyền epg:read ở controller).
  async cmsEpgBySlug(slug: string, date?: string) {
    const day = date || 'default';
    let epgNow: unknown = null;
    try {
      epgNow = await this.playback.channelNow(slug);
    } catch {
      epgNow = null;
    }
    return {
      channel: { name: slug.toUpperCase(), slug },
      date: day,
      epgNow,
      timeline: this.epgLocal.get(slug, day),
    };
  }
}
