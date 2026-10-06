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
  hls?: string | null; // link truc tiep kem theo scan (neu co)
  hlsRotating?: string | null; // link xoay ky san kem theo scan (neu co)
  hlsTranscode?: Array<{ preset: string; hls?: string }> | null;
  hlsTranscodeRotating?: Array<{ preset: string; hls: string }> | null;
}

// Audio-only (VOV1/VOV3): preset khong co p360/p480/p720.
export function isAudioOnly(c: AioChannel): boolean {
  const presets = (c.hlsTranscode || []).map((t) => t.preset);
  return presets.length > 0 && presets.every((p) => !/^p\d+$/i.test(p));
}

export interface EpgTimelineItem {
  time: string;
  title: string;
  status: 'LIVE' | 'UPCOMING' | 'REPLAY';
}

// Map lich AIO (nhieu dang payload) ve timeline chuan. Khong map duoc -> [] (fallback local).
export function mapEpgSchedule(data: any, now = Date.now()): EpgTimelineItem[] {
  const arr: any[] = Array.isArray(data)
    ? data
    : data?.programs || data?.items || data?.schedule || data?.data || [];
  if (!Array.isArray(arr)) return [];
  const out: EpgTimelineItem[] = [];
  for (const it of arr) {
    const title = it?.title || it?.name;
    const start = it?.startTime || it?.start || it?.begin;
    const end = it?.endTime || it?.end;
    if (!title || !start) continue;
    const s = new Date(start).getTime();
    const e = end ? new Date(end).getTime() : NaN;
    const status = Number.isFinite(s) && s > now ? 'UPCOMING' : Number.isFinite(e) && e < now ? 'REPLAY' : 'LIVE';
    const d = new Date(Number.isFinite(s) ? s : now);
    const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    out.push({ time, title: String(title), status });
  }
  return out;
}

export async function getEpgSchedule(cfg: AioConfig, scheduleUrl: string, date: string): Promise<any> {
  const withDate = scheduleUrl.replace('{date}', date);
  // scheduleUrl tuyet doi -> cat origin, giu path cho aioFetch.
  const path = withDate.startsWith('http') ? withDate.replace(/^https?:\/\/[^/]+/, '') : withDate;
  const withParam = path.includes('date=') ? path : `${path}${path.includes('?') ? '&' : '?'}date=${date}`;
  return aioFetch(cfg, withParam);
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
  // Retry 1 lan voi backoff cho loi mang/5xx (docs 14 §4). 401/403/404 tra ngay.
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
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
      if (res.status >= 500) throw new Error(`aio: http ${res.status} (retryable)`);
      if (!res.ok) throw new Error(`aio: http ${res.status}`);
      return data;
    } catch (e: any) {
      lastErr = e;
      const retryable = /retryable|abort|fetch failed|network|ECONN/i.test(e?.message || e?.cause?.message || '');
      if (!retryable || attempt === 1) throw e;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
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
