// Client server-to-server sang VTCAIO (theo docs 14-VTVGO + 25-VTC-ANY).
// VTC ANY KHONG tu ky HMAC - xin link xoay qua POST /api/hls-tokens bang partner key.
export interface AioConfig {
  baseUrl: string;
  partnerKey: string;
}

export interface AioChannel {
  name: string;
  status: string;
  live: boolean;
  epgId?: number | null;
  epgNow?: { title: string; startTime: string; endTime: string } | null;
  epg?: { schedule: string } | null;
}

export interface AioToken {
  token: string;
  exp: number;
  url: string; // path: /hls/<CH>/index.m3u8?token=..&exp=..
}

export function clampTtlMinutes(v: number): number {
  if (!Number.isFinite(v)) return 240;
  return Math.min(1440, Math.max(5, Math.floor(v)));
}

// Master multibitrate: /hls/<CH>/index.m3u8 -> /api/hls/<CH>/master.m3u8 (docs 14 §7),
// giu nguyen token+exp.
export function toMasterUrl(path: string): string {
  return path.replace(/^\/hls\/([^/]+)\/index\.m3u8([?#]|$)/, '/api/hls/$1/master.m3u8$2');
}

export function fullUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

async function aioFetch(cfg: AioConfig, path: string, init: RequestInit = {}): Promise<any> {
  if (!cfg.partnerKey) throw new Error('VTC_PARTNER_KEY is not configured (server-only)');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(fullUrl(cfg.baseUrl, path), {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.partnerKey}`, ...(init.headers || {}) },
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error('aio: invalid partner key (401)');
    if (res.status === 403) throw new Error(`aio: channel not opted-in or stopped (403)`);
    if (res.status === 404) throw new Error('aio: channel not found (404)');
    if (!res.ok) throw new Error(`aio: http ${res.status}`);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export async function getChannels(cfg: AioConfig): Promise<{ baseUrl: string; channels: AioChannel[] }> {
  const data = await aioFetch(cfg, '/api/public/channels');
  return { baseUrl: data.baseUrl || cfg.baseUrl, channels: data.channels || [] };
}

export async function mintToken(cfg: AioConfig, channel: string, ttlMinutes: number): Promise<AioToken> {
  const data = await aioFetch(cfg, '/api/hls-tokens', {
    method: 'POST',
    body: JSON.stringify({ channel: channel.toUpperCase(), ttlMinutes: clampTtlMinutes(ttlMinutes) }),
  });
  if (!data?.token || !data?.exp || !data?.url) throw new Error('aio: bad token response');
  return { token: data.token, exp: data.exp, url: data.url };
}
