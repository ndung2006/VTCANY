import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { clampTtlMinutes, fullUrl, getChannels, getEpgSchedule, isAudioOnly, mintToken, toMasterUrl } from './aio-client';

@Injectable()
export class PlaybackService {
  constructor(private config: ConfigService) {}

  private cfg() {
    return {
      baseUrl: this.config.get<string>('MEDIA_BASE_URL', 'https://vtcaio.vtctech.xyz'),
      partnerKey: this.config.get<string>('VTC_PARTNER_KEY', ''),
    };
  }

  // Link xoay TTL 240 phut theo docs 25-VTC-ANY. FE xin lai cham nhat phut 210.
  async mint(channel: string, ttlMinutes?: number) {
    const cfg = this.cfg();
    const ttl = clampTtlMinutes(ttlMinutes ?? Number(this.config.get('PLAYBACK_TTL_MINUTES', 240)));
    const t = await mintToken(cfg, channel, ttl);
    // Log exp moi lan xin de doi soat 403 voi operator (docs 25 §5.4).
    // eslint-disable-next-line no-console
    console.log(`[playback] mint channel=${channel} exp=${new Date(t.exp).toISOString()} ttl=${ttl}m`);
    return {
      hls_url: fullUrl(cfg.baseUrl, toMasterUrl(t.url)),
      exp: t.exp,
      ttl_seconds: ttl * 60,
    };
  }

  async listChannels() {
    const { baseUrl, channels } = await getChannels(this.cfg());
    return {
      baseUrl,
      channels: channels
        .filter((c) => c.live && c.status === 'RUNNING')
        .map((c) => ({
          name: c.name,
          epgId: c.epgId ?? null,
          epgNow: c.epgNow ?? null,
          audioOnly: isAudioOnly(c),
        })),
    };
  }

  // epgNow de app hien now/next khong can goi them. Null khi kenh chua map EPG.
  async channelNow(slug: string) {
    const { channels } = await getChannels(this.cfg());
    const found = channels.find((c) => c.name.toUpperCase() === slug.toUpperCase());
    return found?.epgNow ?? null;
  }

  // Lich full theo ngay tu AIO (VD 82 chuong trinh/ngay). Tra null khi kenh chua cap EPG.
  async channelSchedule(slug: string, date: string) {
    const { channels } = await getChannels(this.cfg());
    const found = channels.find((c) => c.name.toUpperCase() === slug.toUpperCase());
    const scheduleUrl = found?.epg?.schedule;
    if (!scheduleUrl) return null;
    return getEpgSchedule(this.cfg(), scheduleUrl, date);
  }

  async channelAudioOnly(slug: string): Promise<boolean> {
    try {
      const { channels } = await getChannels(this.cfg());
      const found = channels.find((c) => c.name.toUpperCase() === slug.toUpperCase());
      return found ? isAudioOnly(found) : false;
    } catch {
      return false;
    }
  }
}
