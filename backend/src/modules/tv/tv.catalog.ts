import { createHash } from 'crypto';

// Bước 5/8 — Quy ước nhóm kênh + EPG date-picker (Mục 3C, 11B).

export const TV_GROUPS = [
  'Kênh VTV',
  'KÊNH ĐỊA PHƯƠNG',
  'RADIO',
  'ANTV-Truyền hình CAND',
  'QPVN',
];

export function groupForChannel(name: string): string {
  const n = (name || '').toUpperCase();
  if (n.startsWith('VTV')) return 'Kênh VTV';
  if (n.includes('ANTV')) return 'ANTV-Truyền hình CAND';
  if (n.includes('QPVN')) return 'QPVN';
  if (n.startsWith('VOV') || n.includes('RADIO') || /[-\s]FM$/.test(n) || n.endsWith('RADIO')) return 'RADIO';
  return 'KÊNH ĐỊA PHƯƠNG';
}

// public_id ổn định cho kênh live (không có trong DB).
export function channelPublicId(name: string): string {
  return createHash('sha256').update(`tv-channel:${(name || '').toUpperCase()}`).digest('hex').slice(0, 24);
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Cửa sổ EPG 5 ngày: hôm nay -3 .. hôm nay +1 (VD 26,27,28,Hôm nay,30).
export function epgDateWindow(today = new Date()): string[] {
  const out: string[] = [];
  for (let delta = -3; delta <= 1; delta++) {
    const d = new Date(today);
    d.setDate(d.getDate() + delta);
    out.push(toISODate(d));
  }
  return out;
}

export function dateLabel(iso: string, todayIso: string): string {
  if (iso === todayIso) return 'Hôm nay';
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

// Chuẩn hóa tiếng Việt không dấu để tìm kiếm (Mục 3D).
export function normalizeVi(input: string): string {
  return (input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
