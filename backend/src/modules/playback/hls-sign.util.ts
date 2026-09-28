import { createHmac, timingSafeEqual } from 'crypto';

// Pure helpers so they can be unit-tested without Nest.
export function signToken(secret: string, channel: string, exp: number): string {
  return createHmac('sha256', secret).update(`${channel}.${exp}`).digest('hex');
}

export function buildHlsUrl(baseUrl: string, channel: string, token: string, exp: number): string {
  const base = baseUrl.replace(/\/$/, '');
  return `${base}/hls/${encodeURIComponent(channel)}/master.m3u8?token=${token}&exp=${exp}`;
}

export function verifyToken(secret: string, previousSecret: string | undefined, channel: string, exp: number, token: string): boolean {
  const candidates = [secret, previousSecret].filter(Boolean) as string[];
  const buf = Buffer.from(token, 'hex');
  for (const s of candidates) {
    const expected = Buffer.from(signToken(s, channel, exp), 'hex');
    if (buf.length === expected.length && timingSafeEqual(buf, expected)) return true;
  }
  return false;
}

export function clampTtlMinutes(v: number): number {
  if (Number.isNaN(v)) return 10;
  return Math.min(1440, Math.max(5, Math.floor(v)));
}
