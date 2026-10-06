import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { clampTtlMinutes, fullUrl, getChannels, getEpgSchedule, isAudioOnly, mintToken, toMasterUrl, urlExpMs } from './aio-client';
import type { AioConfig } from './aio-client';
import { AioSourceService } from './aio-source.service';

@Injectable()
export class PlaybackService {
  private readonly logger = new Logger(PlaybackService.name);
  constructor(private config: ConfigService, private aioSources: AioSourceService) {}

  // Uu tien nguon VTCAIO active trong CMS; chua cau hinh thi dung env.
  private async cfg() {
    try {
      const active = await this.aioSources.getActiveConfig();
      if (active?.partnerKey) return active;
    } catch {
      /* fallback env */
    }
    return {
      baseUrl: this.config.get<string>('MEDIA_BASE_URL', 'https://luuchieu1.vtcplay.vn'),
      partnerKey: this.config.get<string>('VTC_PARTNER_KEY', ''),
    };
  }

  // Link xoay TTL 240 phut theo docs 25-VTC-ANY. FE xin lai cham nhat phut 210.
  async mint(channel: string, ttlMinutes?: number) {
    const cfg = await this.cfg();
    const ttl = clampTtlMinutes(ttlMinutes ?? Number(this.config.get('PLAYBACK_TTL_MINUTES', 240)));
    try {
      const t = await mintToken(cfg, channel, ttl);
      const url = fullUrl(cfg.baseUrl, toMasterUrl(t.url));
      // Han that cua link nam trong query param exp cua URL (response body
      // tra exp gan bang now, khong phai han that).
      const exp = urlExpMs(url) ?? t.exp;
      // Log exp moi lan xin de doi soat 403 voi operator (docs 25 §5.4).
      // eslint-disable-next-line no-console
      console.log(`[playback] mint channel=${channel} exp=${new Date(exp).toISOString()} ttl=${ttl}m`);
      return {
        hls_url: url,
        exp,
        ttl_seconds: ttl * 60,
      };
    } catch (e: any) {
      // Fallback: doi tac chua duoc cap quyen /api/hls-tokens
      // (VD "doi tac any da bi tat quyen lay link xoay") -> dung link xoay ky san
      // kem theo channel scan (uu tien p720). Link nay co exp rieng (~4h).
      const url = await this.rotatingUrl(cfg, channel);
      if (!url) throw e;
      this.logger.warn(`mint /api/hls-tokens that bai (${e?.message}), dung link xoay tu scan cho ${channel}`);
      return { hls_url: url, exp: Date.now() + ttl * 60_000, ttl_seconds: ttl * 60 };
    }
  }

  // Tim link xoay ky san trong channel scan cho 1 kenh.
  private async rotatingUrl(cfg: AioConfig, channel: string): Promise<string | null> {
    try {
      const { channels } = await getChannels(cfg);
      const found = (channels || []).find((c) => (c.name || '').toUpperCase() === channel.toUpperCase());
      if (!found) return null;
      const variants = found.hlsTranscodeRotating || found.hlsTranscode || [];
      const pick = variants.find((v) => v.preset === 'p720') || variants[0];
      if (pick?.hls) return pick.hls;
      return found.hlsRotating || found.hls || null;
    } catch {
      return null;
    }
  }

  async listChannels() {
    const { baseUrl, channels } = await getChannels(await this.cfg());
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
    const { channels } = await getChannels(await this.cfg());
    const found = channels.find((c) => c.name.toUpperCase() === slug.toUpperCase());
    return found?.epgNow ?? null;
  }

  // Lich full theo ngay tu AIO (VD 82 chuong trinh/ngay). Tra null khi kenh chua cap EPG.
  async channelSchedule(slug: string, date: string) {
    const { channels } = await getChannels(await this.cfg());
    const found = channels.find((c) => c.name.toUpperCase() === slug.toUpperCase());
    const scheduleUrl = found?.epg?.schedule;
    if (!scheduleUrl) return null;
    return getEpgSchedule(await this.cfg(), scheduleUrl, date);
  }

  async channelAudioOnly(slug: string): Promise<boolean> {
    try {
      const { channels } = await getChannels(await this.cfg());
      const found = channels.find((c) => c.name.toUpperCase() === slug.toUpperCase());
      return found ? isAudioOnly(found) : false;
    } catch {
      return false;
    }
  }
}
