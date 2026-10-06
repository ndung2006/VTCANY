import { Injectable, Optional } from '@nestjs/common';
import { PlaybackService } from '../playback/playback.service';
import { EpgService } from '../content/epg.service';
import { mapEpgSchedule } from '../playback/aio-client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  aioEpgAllowed,
  applyChannelOverrides,
  channelKeyOf,
  channelPublicId,
  epgDateWindow,
  type ChannelOverrideLite,
} from './tv.catalog';

export interface TvChannelItem {
  public_id: string;
  name: string;
  logo: string | null;
  audio_only: boolean;
}

const OVERRIDE_FIELDS = [
  'isVisible', 'sortOrder', 'groupName', 'displayName', 'description',
  'logoUrl', 'bannerUrl', 'planId', 'hlsUrl', 'dashUrl', 'catchupHlsUrl', 'useAioEpg', 'isCustom',
] as const;

// Nguồn: kênh live AIO + lịch AIO, fallback lịch local CMS nhập tay.
// Lop quan tri channel_overrides (Postgres) quyet dinh kenh nao duoc hien thi:
// an/hien, nhom, thu tu, ten/logo/banner, goi cuoc, nguon phat ghi de, kenh tu them.
// Khong co DATABASE_URL/Prisma loi -> chay khong override (hien tat ca kenh AIO).
@Injectable()
export class TvService {
  constructor(
    private playback: PlaybackService,
    private epgLocal: EpgService,
    @Optional() private prisma?: PrismaService,
  ) {}

  private async loadOverrides(): Promise<ChannelOverrideLite[]> {
    if (!this.prisma) return [];
    try {
      const rows = await this.prisma.channelOverride.findMany();
      return rows as unknown as ChannelOverrideLite[];
    } catch {
      return [];
    }
  }

  async listGroups(): Promise<{ groups: Array<{ name: string; channels: any[] }> }> {
    let channels: Array<{ name: string; audioOnly?: boolean }> = [];
    try {
      const res = await this.playback.listChannels();
      channels = res.channels;
    } catch {
      // AIO lỗi -> vẫn hiển thị kênh tự thêm (nếu có), còn lại để UI tự xử lý.
    }
    const overrides = await this.loadOverrides();
    return applyChannelOverrides(channels, overrides);
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
      // rơi xuống kiểm tra kênh tự thêm bên dưới
    }
    const overrides = await this.loadOverrides();
    for (const o of overrides) {
      if (!o.isCustom) continue;
      const display = (o.displayName || '').trim() || o.channelKey;
      if (channelPublicId(display) === publicId) return o.channelKey;
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

    const overrides = await this.loadOverrides();
    const override = overrides.find((o) => channelKeyOf(o.channelKey) === channelKeyOf(name));

    let hlsUrl: string | null = null;
    let hlsExp: number | null = null; // ms epoch — FE tu xin lai link truoc khi het han (link xoay 4h)
    let dashUrl: string | null = override?.dashUrl || null;
    let catchupUrl: string | null = override?.catchupHlsUrl || null;
    if (override?.hlsUrl) {
      hlsUrl = override.hlsUrl;
    } else {
      try {
        const t = await this.playback.mint(name);
        hlsUrl = t.hls_url;
        hlsExp = t.exp || null;
      } catch {
        hlsUrl = null;
        hlsExp = null;
      }
    }

    let timeline: Array<{ time: string; title: string; status: string }> = [];
    let fromAio = false;
    if (aioEpgAllowed(override)) {
      try {
        const raw = await this.playback.channelSchedule(name, day);
        if (raw) timeline = mapEpgSchedule(raw);
        fromAio = timeline.length > 0;
      } catch {
        timeline = [];
      }
    }
    if (timeline.length === 0) {
      timeline = this.epgLocal.get(name, day).map((it) => ({ time: it.time, title: it.title, status: it.status }));
    }

    return {
      channel: {
        public_id: publicId,
        name: override?.displayName || name,
        logo: override?.logoUrl || null,
        banner_url: override?.bannerUrl || null,
        hls_url: hlsUrl,
        hls_exp: hlsExp,
        dash_url: dashUrl,
        catchup_hls_url: catchupUrl,
      },
      epg_dates: epgDateWindow(today),
      epg_source: fromAio ? 'aio' : 'local',
      timeline,
    };
  }

  // Luồng CMS (slug tên kênh, yêu cầu quyền epg:read ở controller).
  async cmsEpgBySlug(slug: string, date?: string) {
    const day = date || 'default';
    let epgNow: unknown = null;
    const overrides = await this.loadOverrides();
    const override = overrides.find((o) => channelKeyOf(o.channelKey) === channelKeyOf(slug));
    if (aioEpgAllowed(override)) {
      try {
        epgNow = await this.playback.channelNow(slug);
      } catch {
        epgNow = null;
      }
    }
    return {
      channel: { name: slug.toUpperCase(), slug },
      date: day,
      epgNow,
      timeline: this.epgLocal.get(slug, day),
    };
  }

  // ---- Quan tri hien thi kenh (CMS, catalog:read/write) ----
  // Danh sach gop: moi kenh AIO (ke ca dang bi an) + override cua no; cong kenh tu them.
  async adminListChannels() {
    let aio: Array<{ name: string; audioOnly?: boolean }> = [];
    let aioError = false;
    try {
      const res = await this.playback.listChannels();
      aio = res.channels;
    } catch {
      aioError = true;
    }
    const overrides = await this.loadOverrides();
    const byKey = new Map(overrides.map((o) => [channelKeyOf(o.channelKey), o]));
    const seen = new Set<string>();
    const items: any[] = [];
    for (const c of aio) {
      const key = channelKeyOf(c.name);
      seen.add(key);
      const o = byKey.get(key) || null;
      items.push({
        key,
        name: c.name,
        source: 'aio',
        audioOnly: !!c.audioOnly,
        hasOverride: !!o,
        isVisible: o?.isVisible !== false,
        sortOrder: o?.sortOrder ?? null,
        groupName: o?.groupName ?? null,
        displayName: o?.displayName ?? null,
        description: o?.description ?? null,
        logoUrl: o?.logoUrl ?? null,
        bannerUrl: o?.bannerUrl ?? null,
        planId: o?.planId ?? null,
        hlsUrl: o?.hlsUrl ?? null,
        dashUrl: o?.dashUrl ?? null,
        catchupHlsUrl: o?.catchupHlsUrl ?? null,
        useAioEpg: o?.useAioEpg !== false,
      });
    }
    for (const o of overrides) {
      const key = channelKeyOf(o.channelKey);
      if (!o.isCustom || seen.has(key)) continue;
      items.push({
        key,
        name: o.displayName || o.channelKey,
        source: 'custom',
        audioOnly: false,
        hasOverride: true,
        isVisible: o.isVisible !== false,
        sortOrder: o.sortOrder ?? null,
        groupName: o.groupName ?? null,
        displayName: o.displayName ?? null,
        description: o.description ?? null,
        logoUrl: o.logoUrl ?? null,
        bannerUrl: o.bannerUrl ?? null,
        planId: o.planId ?? null,
        hlsUrl: o.hlsUrl ?? null,
        dashUrl: o.dashUrl ?? null,
        catchupHlsUrl: o.catchupHlsUrl ?? null,
        useAioEpg: o.useAioEpg !== false,
      });
    }
    items.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    return { data: items, meta: { total: items.length, aioError, dbReady: !!this.prisma } };
  }

  async upsertOverride(keyRaw: string, dto: Record<string, any>) {
    if (!this.prisma) throw new Error('database not configured');
    const channelKey = channelKeyOf(keyRaw || dto?.displayName || dto?.name || '');
    if (!channelKey) throw new Error('channel key required');
    const data: Record<string, any> = {};
    for (const f of OVERRIDE_FIELDS) {
      if (dto[f] === undefined) continue;
      data[f] = dto[f] === '' ? null : dto[f];
    }
    if (data.sortOrder !== undefined && data.sortOrder !== null) data.sortOrder = Math.trunc(Number(data.sortOrder)) || 0;
    const row = await this.prisma.channelOverride.upsert({
      where: { channelKey },
      create: { channelKey, ...data },
      update: data,
    });
    return row;
  }

  async deleteOverride(keyRaw: string) {
    if (!this.prisma) throw new Error('database not configured');
    const channelKey = channelKeyOf(keyRaw);
    await this.prisma.channelOverride.deleteMany({ where: { channelKey } });
    return { deleted: true, key: channelKey };
  }
}
