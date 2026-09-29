import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { clampTtlMinutes, fullUrl, getChannels, mintToken, toMasterUrl } from './aio-client';

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
        .map((c) => ({ name: c.name, epgId: c.epgId ?? null, epgNow: c.epgNow ?? null })),
    };
  }

  // epgNow de app hien now/next khong can goi them. Null khi kenh chua map EPG.
  async channelNow(slug: string) {
    const { channels } = await getChannels(this.cfg());
    const found = channels.find((c) => c.name.toUpperCase() === slug.toUpperCase());
    return found?.epgNow ?? null;
  }
}
