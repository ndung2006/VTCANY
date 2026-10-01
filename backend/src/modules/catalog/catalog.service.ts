import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

// Catalog CMS theo mau VTCPlay — persist Postgres qua Prisma (bang catalog_items/
// catalog_episodes/catalog_settings, payload Json giu nguyen API shape linh hoat).
// Truoc day la in-memory Map: du lieu mat moi lan restart/redeploy.

export interface Movie {
  id: string;
  title: string;
  originalTitle?: string;
  description?: string;
  categoryIds?: string[];
  genreIds?: string[];
  actorIds?: string[];
  planId?: string;
  ageLimit?: string;
  publishDate?: string;
  duration?: string; // h:mm:ss
  year?: number;
  type?: 'single' | 'series' | 'short'; // Phim le / Phim bo / Short
  hasSubtitle?: boolean;
  hasDubbing?: boolean;
  isVisible?: boolean;
  distribution?: 'free' | 'paid';
  price?: number;
  poster?: string;
  thumbnail?: string;
  createdAt: string;
}

export interface Episode {
  id: string;
  movieId: string;
  title: string;
  description?: string;
  order?: number;
  publishDate?: string;
  duration?: string;
  subtitleEn?: string;
  subtitleVi?: string;
  thumbnail?: string;
  videoFileId?: string;
  isVisible?: boolean;
  showAds?: boolean;
  distribution?: 'inherit' | 'free' | 'paid';
  price?: number;
  createdAt: string;
}

export interface FlatVideo {
  id: string;
  title: string;
  description?: string;
  categoryId?: string;
  planId?: string;
  distribution?: 'free' | 'paid';
  price?: number;
  thumbnail?: string;
  videoFileId?: string;
  duration?: string;
  isVisible?: boolean;
  createdAt: string;
}

export interface ShortItem {
  id: string;
  title: string;
  description?: string;
  videoFileId?: string;
  thumbnail?: string;
  isVisible?: boolean;
  createdAt: string;
}

export interface Genre { id: string; title: string; isVisible?: boolean; createdAt: string }
export interface Actor { id: string; name: string; avatar?: string; bio?: string; createdAt: string }
export interface Playlist { id: string; title: string; description?: string; itemIds?: string[]; isVisible?: boolean; createdAt: string }
export interface Article { id: string; title: string; slug?: string; content?: string; thumbnail?: string; isVisible?: boolean; createdAt: string }
export interface CmsEvent { id: string; title: string; description?: string; thumbnail?: string; startDate?: string; endDate?: string; isVisible?: boolean; createdAt: string }
export interface Plan { id: string; name: string; isVisible?: boolean; createdAt: string }
export interface NotificationItem { id: string; title: string; body?: string; target?: string; createdAt: string }
export interface Keyword { id: string; keyword: string; createdAt: string }
export interface BannedWord { id: string; word: string; createdAt: string }
export interface Livestream { id: string; title: string; streamUrl?: string; thumbnail?: string; status?: 'scheduled' | 'live' | 'ended'; scheduledAt?: string; createdAt: string }

export interface Banner {
  id: string;
  section: string; // home | tv | movies | video | short | entertainment
  platform: string; // web | mobile
  title: string;
  linkType?: string;
  linkTarget?: string;
  sortOrder?: number;
  visibleFrom?: string;
  visibleTo?: string;
  isVisible?: boolean;
  imageWeb?: string;
  imageMobile?: string;
  createdAt: string;
}

export interface Rail {
  id: string;
  section: string;
  platform: string;
  title: string;
  contentType?: string;
  categoryId?: string;
  sortOrder?: number;
  visibleFrom?: string;
  visibleTo?: string;
  style?: string;
  isVisible?: boolean;
  createdAt: string;
}

type EntityName =
  | 'movies' | 'videos' | 'shorts' | 'genres' | 'actors' | 'playlists'
  | 'articles' | 'events' | 'plans' | 'notifications' | 'keywords'
  | 'banned' | 'livestreams' | 'banners' | 'rails';

const REQUIRED: Record<EntityName, string[]> = {
  movies: ['title'],
  videos: ['title'],
  shorts: ['title'],
  genres: ['title'],
  actors: ['name'],
  playlists: ['title'],
  articles: ['title'],
  events: ['title'],
  plans: ['name'],
  notifications: ['title'],
  keywords: ['keyword'],
  banned: ['word'],
  livestreams: ['title'],
  banners: ['title', 'section'],
  rails: ['title', 'section'],
};

// Prefix rieng tung entity — id la PRIMARY KEY chung mot bang nen khong duoc trung prefix.
const PREFIX: Record<EntityName, string> = {
  movies: 'mo', videos: 'vi', shorts: 'sh', genres: 'ge', actors: 'ac',
  playlists: 'pl', articles: 'ar', events: 'ev', plans: 'pn', notifications: 'no',
  keywords: 'ke', banned: 'bw', livestreams: 'ls', banners: 'bn', rails: 'rl',
};

function nid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function checkRequired(required: string[], data: any): void {
  for (const f of required) {
    if (data[f] === undefined || data[f] === null || String(data[f]).trim() === '') {
      throw new Error(`${f} is required`);
    }
  }
}

function pageOpts(page?: number, limit?: number): { p: number; l: number } {
  const p = Math.max(1, Math.floor(page || 1));
  const l = Math.min(100, Math.max(1, Math.floor(limit || 20)));
  return { p, l };
}

function paginate(all: any[], page?: number, limit?: number): any {
  const { p, l } = pageOpts(page, limit);
  return { data: all.slice((p - 1) * l, p * l), meta: { page: p, limit: l, total: all.length } };
}

// --- Cong khai cho web (apps/web): chi noi dung dang xuat ban ---
// public_id dang 24-hex (sha256) de khop quy uoc URL /short|video/{slug}-{24hex}
// cua apps/web (utils/url.ts), giong cach channelPublicId lam cho kenh TV.
export function catalogPublicId(id: string): string {
  return createHash('sha256').update(`catalog:${id}`).digest('hex').slice(0, 24);
}

export function slugifyVi(input: string): string {
  return (input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

// Ban cong khai: chi field hien thi, khong lo videoFileId/upload noi bo.
export function toPublicItem(item: any): any {
  if (!item) return item;
  return {
    id: item.id,
    public_id: catalogPublicId(item.id),
    slug: slugifyVi(item.title || item.name || ''),
    title: item.title || item.name || '',
    description: item.description || '',
    thumbnail: item.thumbnail || item.thumbnailUrl || '',
    poster: item.posterUrl || '',
    duration: item.duration ?? null,
    ageLimit: item.ageLimit ?? null,
    planId: item.planId ?? null,
    publishedAt: item.publishedAt ?? null,
    createdAt: item.createdAt,
  };
}

@Injectable()
export class CatalogService implements OnModuleInit {
  private readonly logger = new Logger(CatalogService.name);

  constructor(private prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    // Seed giong VTCPlay: 2 goi cuoc mac dinh — chi khi bang plans con trong.
    try {
      const n = await this.prisma.catalogItem.count({ where: { entity: 'plans' } });
      if (n === 0) {
        await this.create('plans', { name: 'Phim lẻ PL1', isVisible: true });
        await this.create('plans', { name: 'Chung VTC', isVisible: true });
        this.logger.log('Da seed 2 goi cuoc mac dinh.');
      }
    } catch (e) {
      this.logger.warn(`Bo qua seed plans (DB chua san sang?): ${(e as Error).message}`);
    }
  }

  private assertEntity(name: string): EntityName {
    if (!(name in REQUIRED)) throw new Error('unknown entity');
    return name as EntityName;
  }

  // ---- Generic CRUD (bang catalog_items) ----
  async create(name: string, input: any): Promise<any> {
    const entity = this.assertEntity(name);
    const data = input || {};
    checkRequired(REQUIRED[entity], data);
    const item = { ...data, id: data.id || nid(PREFIX[entity]), createdAt: new Date().toISOString() };
    await this.prisma.catalogItem.create({ data: { id: item.id, entity, data: item } });
    return item;
  }

  async get(name: string, id: string): Promise<any> {
    const entity = this.assertEntity(name);
    const row = await this.prisma.catalogItem.findFirst({ where: { id, entity } });
    if (!row) throw new Error('not found');
    return row.data as any;
  }

  async update(name: string, id: string, patch: any): Promise<any> {
    const cur = await this.get(name, id);
    const next = { ...cur, ...(patch || {}), id: cur.id, createdAt: cur.createdAt };
    await this.prisma.catalogItem.update({ where: { id }, data: { data: next } });
    return next;
  }

  async remove(name: string, id: string): Promise<void> {
    await this.get(name, id); // 404 neu khong ton tai
    await this.prisma.catalogItem.delete({ where: { id } });
  }

  async list(name: string, opts: { page?: number; limit?: number; q?: string } = {}): Promise<any> {
    const entity = this.assertEntity(name);
    const rows = await this.prisma.catalogItem.findMany({
      where: { entity },
      orderBy: { createdAt: 'desc' },
    });
    let all = rows.map((r) => r.data as any);
    if (opts.q) {
      const q = opts.q.toLowerCase();
      all = all.filter((it) => JSON.stringify(it).toLowerCase().includes(q));
    }
    return paginate(all, opts.page, opts.limit);
  }

  // Web cong khai (/catalog/shorts|videos): chi noi dung dang xuat ban.
  async listPublic(name: string, opts: { page?: number; limit?: number } = {}): Promise<any> {
    const res = await this.list(name, { page: 1, limit: 100 });
    const visible = (res.data || []).filter((it: any) => it.isVisible !== false).map(toPublicItem);
    return paginate(visible, opts.page, opts.limit);
  }

  async getPublic(name: string, publicId: string): Promise<any> {
    const res = await this.list(name, { page: 1, limit: 100 });
    const found = (res.data || []).find(
      (it: any) => it.isVisible !== false && catalogPublicId(it.id) === publicId,
    );
    if (!found) throw new Error('not found');
    return toPublicItem(found);
  }

  async count(name: string): Promise<number> {
    const entity = this.assertEntity(name);
    return this.prisma.catalogItem.count({ where: { entity } });
  }

  // ---- Episodes (nam trong movie, bang catalog_episodes) ----
  async createEpisode(movieId: string, input: any): Promise<Episode> {
    await this.get('movies', movieId); // 404 neu movie khong ton tai
    const data = input || {};
    if (!data.title || !String(data.title).trim()) throw new Error('title is required');
    const item = { ...data, movieId, id: data.id || nid('ep'), createdAt: new Date().toISOString() };
    await this.prisma.catalogEpisode.create({ data: { id: item.id, movieId, data: item } });
    return item as Episode;
  }

  async listEpisodes(movieId: string, page = 1, limit = 20): Promise<any> {
    await this.get('movies', movieId); // 404 neu movie khong ton tai
    const rows = await this.prisma.catalogEpisode.findMany({
      where: { movieId },
      orderBy: { createdAt: 'desc' },
    });
    return paginate(rows.map((r) => r.data as any), page, limit);
  }

  async getEpisode(id: string): Promise<Episode> {
    const row = await this.prisma.catalogEpisode.findUnique({ where: { id } });
    if (!row) throw new Error('not found');
    return row.data as unknown as Episode;
  }

  async updateEpisode(id: string, patch: any): Promise<Episode> {
    const cur = await this.getEpisode(id);
    const next = { ...cur, ...(patch || {}), id: cur.id, createdAt: cur.createdAt, movieId: cur.movieId };
    await this.prisma.catalogEpisode.update({ where: { id }, data: { data: next } });
    return next as Episode;
  }

  async deleteEpisode(id: string): Promise<void> {
    await this.getEpisode(id);
    await this.prisma.catalogEpisode.delete({ where: { id } });
  }

  // ---- Xuat ban / an noi dung VOD (cong tac isVisible) ----
  async setPublished(name: string, id: string, published: boolean): Promise<any> {
    return this.update(name, id, { isVisible: published });
  }

  async setEpisodePublished(id: string, published: boolean): Promise<Episode> {
    return this.updateEpisode(id, { isVisible: published });
  }

  async episodeCount(): Promise<number> {
    return this.prisma.catalogEpisode.count();
  }

  // ---- Settings (key-value, bang catalog_settings) ----
  async getSettings(): Promise<Record<string, string>> {
    const rows = await this.prisma.catalogSetting.findMany();
    // Khoa noi bo (epg:...) dung chung bang nhung khong phai cau hinh CMS.
    return Object.fromEntries(rows.filter((r) => !r.key.startsWith('epg:')).map((r) => [r.key, r.value]));
  }

  async putSettings(patch: Record<string, string>): Promise<Record<string, string>> {
    for (const [k, v] of Object.entries(patch || {})) {
      if (k.startsWith('epg:')) continue; // khoa noi bo, chi EpgService duoc ghi
      await this.prisma.catalogSetting.upsert({
        where: { key: k },
        create: { key: k, value: String(v) },
        update: { value: String(v) },
      });
    }
    return this.getSettings();
  }

  // ---- Analytics ----
  async summary(extra: { users: number; channels: number }): Promise<any> {
    const [movies, episodes, videos, shorts] = await Promise.all([
      this.count('movies'),
      this.episodeCount(),
      this.count('videos'),
      this.count('shorts'),
    ]);
    return {
      users: extra.users,
      movies,
      episodes,
      channels: extra.channels,
      videos,
      shorts,
    };
  }
}
