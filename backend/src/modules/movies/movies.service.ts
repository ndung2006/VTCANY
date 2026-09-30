import { Injectable } from '@nestjs/common';
import { MOVIES, MovieRec, buildTabs } from './movies.catalog';

const HEX24 = /^[0-9a-f]{24}$/;

// Phase hiện tại: catalog + favorites in-memory. Len Postgres: videos/episodes
// + bảng favorites(user_id, public_id), giữ nguyên shape API.
@Injectable()
export class MoviesService {
  private favorites = new Map<string, Set<string>>(); // userId -> publicIds

  assertValidPublicId(publicId: string): void {
    if (!HEX24.test(publicId)) {
      const err: any = new Error('invalid public_id (must be 24 hex chars)');
      err.status = 400;
      throw err;
    }
  }

  get(publicId: string): MovieRec {
    this.assertValidPublicId(publicId);
    const m = MOVIES.find((x) => x.public_id === publicId);
    if (!m) {
      const err: any = new Error('movie not found');
      err.status = 404;
      throw err;
    }
    return m;
  }

  detail(publicId: string, userId?: string) {
    const m = this.get(publicId);
    const related = MOVIES.filter((x) => x.public_id !== publicId)
      .slice(0, 10)
      .map((x) => ({
        id: `vid-${x.slug}`,
        public_id: x.public_id,
        slug: x.slug,
        title: x.title,
        thumbnail: x.poster,
        aspect: '3:4',
        is_premium: false,
        type: 'phim',
      }));
    return {
      video_info: {
        public_id: m.public_id,
        title: m.title,
        release_year: m.release_year,
        total_episodes: `${m.total_episodes} / ${m.total_episodes} Tập`,
        description: m.description,
        poster: m.poster,
        backdrop: m.backdrop,
        stream_urls: { hls: m.episodes[0]?.hls_url },
        is_favorited: userId ? (this.favorites.get(userId)?.has(publicId) ?? false) : false,
        tabs: buildTabs(m.total_episodes),
      },
      episodes: m.episodes.map(({ hls_url, ...ep }) => ({ ...ep, hls_url })),
      related_videos: related,
    };
  }

  toggleFavorite(userId: string, publicId: string): { is_favorited: boolean } {
    this.get(publicId); // 404 nếu không tồn tại
    let set = this.favorites.get(userId);
    if (!set) {
      set = new Set();
      this.favorites.set(userId, set);
    }
    if (set.has(publicId)) set.delete(publicId);
    else set.add(publicId);
    return { is_favorited: set.has(publicId) };
  }
}
