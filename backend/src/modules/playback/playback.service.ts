import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { buildHlsUrl, clampTtlMinutes, signToken } from './hls-sign.util';

@Injectable()
export class PlaybackService {
  constructor(private config: ConfigService) {}

  mint(channel: string, ttlMinutes?: number) {
    const secret = this.config.get<string>('VTC_HLS_SECRET', '');
    if (!secret) throw new Error('VTC_HLS_SECRET is not configured (server-only)');
    const baseUrl = this.config.get<string>('MEDIA_BASE_URL', 'https://vtcaio.vtctech.xyz');
    const ttl = clampTtlMinutes(ttlMinutes ?? Number(this.config.get('PLAYBACK_TTL_MINUTES', 10)));
    const exp = Date.now() + ttl * 60 * 1000;
    const token = signToken(secret, channel, exp);
    return {
      hls_url: buildHlsUrl(baseUrl, channel, token, exp),
      exp,
      ttl_seconds: ttl * 60,
    };
  }
}
