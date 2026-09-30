import { Injectable } from '@nestjs/common';

// Phase 1: in-memory stores theo mau VTCPlay CMS.
// Postgres (Prisma) thay Map ma khong doi API shape.

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

class Store {
  private items = new Map<string, any>();
  private seq = 0;
  constructor(private prefix: string, private required: string[]) {}

  private nid(): string {
    return `${this.prefix}-${Date.now().toString(36)}-${(this.seq++).toString(36)}`;
  }

  create(data: any): any {
    for (const f of this.required) {
      if (data[f] === undefined || data[f] === null || String(data[f]).trim() === '') {
        throw new Error(`${f} is required`);
      }
    }
    const item = { ...data, id: data.id || this.nid(), createdAt: new Date().toISOString() };
    this.items.set(item.id, item);
    return item;
  }

  get(id: string): any {
    const it = this.items.get(id);
    if (!it) throw new Error('not found');
    return it;
  }

  update(id: string, patch: any): any {
    const it = this.get(id);
    const next = { ...it, ...patch, id: it.id, createdAt: it.createdAt };
    this.items.set(id, next);
    return next;
  }

  remove(id: string): void {
    if (!this.items.delete(id)) throw new Error('not found');
  }

  list(opts: { page?: number; limit?: number; q?: string; filter?: (it: any) => boolean } = {}): any {
    const p = Math.max(1, Math.floor(opts.page || 1));
    const l = Math.min(100, Math.max(1, Math.floor(opts.limit || 20)));
    let all = [...this.items.values()].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    if (opts.q) {
      const q = opts.q.toLowerCase();
      all = all.filter((it) => JSON.stringify(it).toLowerCase().includes(q));
    }
    if (opts.filter) all = all.filter(opts.filter);
    return { data: all.slice((p - 1) * l, p * l), meta: { page: p, limit: l, total: all.length } };
  }

  count(): number {
    return this.items.size;
  }
}

@Injectable()
export class CatalogService {
  private stores = new Map<EntityName, Store>();
  private episodes = new Store('ep', []);
  private settings = new Map<string, string>();

  constructor() {
    (Object.keys(REQUIRED) as EntityName[]).forEach((name) => {
      this.stores.set(name, new Store(name.slice(0, 2), REQUIRED[name]));
    });
    // Seed giong VTCPlay: 2 goi cuoc mac dinh.
    const plans = this.stores.get('plans')!;
    plans.create({ name: 'Phim lẻ PL1', isVisible: true });
    plans.create({ name: 'Chung VTC', isVisible: true });
  }

  store(name: string): Store {
    const s = this.stores.get(name as EntityName);
    if (!s) throw new Error('unknown entity');
    return s;
  }

  // ---- Episodes (nam trong movie) ----
  createEpisode(movieId: string, data: any): Episode {
    this.store('movies').get(movieId); // 404 neu movie khong ton tai
    if (!data.title || !String(data.title).trim()) throw new Error('title is required');
    return this.episodes.create({ ...data, movieId }) as Episode;
  }

  listEpisodes(movieId: string, page = 1, limit = 20): any {
    this.store('movies').get(movieId);
    return this.episodes.list({ page, limit, filter: (e) => e.movieId === movieId });
  }

  getEpisode(id: string): Episode {
    return this.episodes.get(id);
  }

  updateEpisode(id: string, patch: any): Episode {
    return this.episodes.update(id, patch);
  }

  deleteEpisode(id: string): void {
    this.episodes.remove(id);
  }

  episodeCount(): number {
    return this.episodes.count();
  }

  // ---- Settings (key-value) ----
  getSettings(): Record<string, string> {
    return Object.fromEntries(this.settings);
  }

  putSettings(patch: Record<string, string>): Record<string, string> {
    for (const [k, v] of Object.entries(patch || {})) this.settings.set(k, String(v));
    return this.getSettings();
  }

  // ---- Analytics ----
  summary(extra: { users: number; channels: number }): any {
    return {
      users: extra.users,
      movies: this.store('movies').count(),
      episodes: this.episodeCount(),
      channels: extra.channels,
      videos: this.store('videos').count(),
      shorts: this.store('shorts').count(),
    };
  }
}
