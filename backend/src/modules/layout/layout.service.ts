import { Injectable } from '@nestjs/common';
import { HOME_SEED, HomeBlockSeed } from './seed-data';

// Server-Driven UI: GET /api/v1/layout/home?platform=WEB (Mục 3A).
// Nguồn đọc: bảng layout_blocks (migration 0001) — Phase hiện tại dùng seed
// in-memory nạp lúc boot; Redis cache 60s — Phase hiện tại dùng cache
// in-memory TTL, thay bằng Redis mà không đổi shape API.

const CACHE_TTL_MS = 60_000;

@Injectable()
export class LayoutService {
  private blocks: HomeBlockSeed[] = [...HOME_SEED];
  private cache = new Map<string, { exp: number; data: { platform: string; layout_blocks: HomeBlockSeed[] } }>();

  // HANG DOI DB (Postgres layout_blocks): thay thân hàm này bằng SELECT ...
  // WHERE platform=$1 AND is_active ORDER BY "order", giữ nguyên return shape.
  getHome(platform = 'WEB'): { platform: string; layout_blocks: HomeBlockSeed[] } {
    const key = (platform || 'WEB').toUpperCase();
    const now = Date.now();
    const hit = this.cache.get(key);
    if (hit && hit.exp > now) return hit.data;
    const data = { platform: key, layout_blocks: this.blocks.filter((b) => b.items.length > 0) };
    this.cache.set(key, { exp: now + CACHE_TTL_MS, data });
    return data;
  }

  // Seed ghi đè (dùng cho script seed / test).
  replaceAll(blocks: HomeBlockSeed[]): void {
    this.blocks = blocks;
    this.cache.clear();
  }

  count(): number {
    return this.blocks.length;
  }
}
