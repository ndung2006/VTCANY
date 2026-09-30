import { createHash } from 'crypto';

// Bước 2/8 — Seed trang chủ giống VTC Play (Mục 3A, 11B).
// 6 blocks: 1 HERO_CAROUSEL (5 slides) + 5 HORIZONTAL_LIST (mỗi rail 8 items).
// public_id: 24 hex ổn định (sha256 theo namespace:index), đúng quy ước Bước 1.

export function seedHex(namespace: string, index: number): string {
  return createHash('sha256').update(`${namespace}:${index}`).digest('hex').slice(0, 24);
}

export interface HeroItem {
  id: string;
  image_url: string;
  title: string;
  action: 'OPEN_MOVIE';
  target_id: string; // {slug}-{24hex}
}

export interface RailItem {
  id: string;
  public_id: string; // 24hex
  slug: string;
  title: string;
  thumbnail: string;
  aspect: '3:2' | '3:4';
  is_premium: boolean;
}

export interface HomeBlockSeed {
  order: number;
  type: 'HERO_CAROUSEL' | 'HORIZONTAL_LIST';
  title?: string;
  target_url?: string;
  card_aspect?: '3:2' | '3:4';
  items: Array<HeroItem | RailItem>;
}

const thumb = (seed: string, w: number, h: number) =>
  `https://picsum.photos/seed/${seed}/${w}/${h}`;

const HERO_MOVIES = [
  { slug: 'tham-tinh', title: 'Thâm Tình', publicId: '6925687120dd0e58b0facba3' },
  { slug: 'kick-off-the-thao', title: 'Kick-off Thể Thao', publicId: seedHex('hero', 1) },
  { slug: 'check-in-viet-nam', title: 'Check in Việt Nam', publicId: seedHex('hero', 2) },
  { slug: 'phim-chieu-rap-hay', title: 'Phim Chiếu Rạp Hay', publicId: seedHex('hero', 3) },
  { slug: 'short-noi-bat', title: 'Short Nổi Bật', publicId: seedHex('hero', 4) },
];

interface RailDef {
  title: string;
  slug: string;
  catId: string;
  cardAspect: '3:2' | '3:4';
  prefix: string;
  topics: string[];
}

const RAILS: RailDef[] = [
  {
    title: 'KICK-OFF THỂ THAO',
    slug: 'kick-off-the-thao',
    catId: '696891e96f1d98f16f5f7af2',
    cardAspect: '3:2',
    prefix: 'kickoff',
    topics: ['Bóng đá', 'Thể thao', 'Bình luận', 'Highlight', 'Tin nóng', 'Phỏng vấn', 'Tập luyện', 'Góc nhìn'],
  },
  {
    title: 'Check in Việt Nam',
    slug: 'check-in-viet-nam',
    catId: seedHex('cat', 11),
    cardAspect: '3:2',
    prefix: 'checkin',
    topics: ['Hà Nội', 'Huế', 'Đà Nẵng', 'TP.HCM', 'Phú Quốc', 'Sa Pa', 'Hội An', 'Nha Trang'],
  },
  {
    title: 'Phim bộ',
    slug: 'phim-bo',
    catId: seedHex('cat', 12),
    cardAspect: '3:4',
    prefix: 'phimbo',
    topics: ['Thâm Tình', 'Mưa Bụi', 'Sóng Gió', 'Hương Vị', 'Đêm Trăng', 'Lối Về', 'Bến Xưa', 'Nắng Mới'],
  },
  {
    title: 'Short videos',
    slug: 'short-videos',
    catId: seedHex('cat', 13),
    cardAspect: '3:4',
    prefix: 'short',
    topics: ['Hài ngắn', 'Ẩm thực', 'Du lịch', 'Âm nhạc', 'Thể thao', 'Phim ngắn', 'Vlog', 'Tin nhanh'],
  },
  {
    title: 'Phim chiếu rạp',
    slug: 'phim-chieu-rap',
    catId: seedHex('cat', 14),
    cardAspect: '3:2',
    prefix: 'rap',
    topics: ['Hành động', 'Tình cảm', 'Hài', 'Kinh dị', 'Hoạt hình', 'Chiến tranh', 'Phiêu lưu', 'Tâm lý'],
  },
];

function buildRails(): HomeBlockSeed[] {
  return RAILS.map((rail, ri) => ({
    order: ri + 2,
    type: 'HORIZONTAL_LIST' as const,
    title: rail.title,
    target_url: `/danh-muc/${rail.slug}-${rail.catId}`,
    card_aspect: rail.cardAspect,
    items: rail.topics.map((topic, i): RailItem => {
      const publicId = seedHex(rail.prefix, i);
      const slug = `${rail.slug}-${i + 1}`;
      const [w, h] = rail.cardAspect === '3:2' ? [640, 427] : [400, 533];
      return {
        id: `vid-${rail.prefix}-${i + 1}`,
        public_id: publicId,
        slug,
        title: rail.prefix === 'kickoff' ? `KICK - OFF Thể thao | 29/09/2026 — ${topic} ${i + 1}` : `${topic} ${i + 1}`,
        thumbnail: thumb(`${rail.prefix}-${i}`, w, h),
        aspect: rail.cardAspect,
        is_premium: false,
      };
    }),
  }));
}

export const HOME_SEED: HomeBlockSeed[] = [
  {
    order: 1,
    type: 'HERO_CAROUSEL',
    items: HERO_MOVIES.map((m, i): HeroItem => ({
      id: `banner-${i + 1}`,
      image_url: thumb(`hero-${i}`, 1280, 720),
      title: m.title,
      action: 'OPEN_MOVIE',
      target_id: `${m.slug}-${m.publicId}`,
    })),
  },
  ...buildRails(),
];
