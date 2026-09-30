import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';

// Danh mục (categories) — Phase 1: in-memory, thay bằng Prisma (bảng categories)
// mà không đổi shape API.

export interface Category {
  id: string;
  publicId: string; // 24hex
  name: string;
  slug: string;
  parentId: string | null;
  icon?: string;
  thumbnail?: string;
  description?: string;
  sortOrder: number;
  isVisible: boolean;
  platforms: string[];
  appliesTo: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryDto {
  name: string;
  slug?: string;
  parentId?: string | null;
  icon?: string;
  thumbnail?: string;
  description?: string;
  sortOrder?: number;
  isVisible?: boolean;
  platforms?: string[];
  appliesTo?: string[];
}

function generatePublicId(): string {
  return randomBytes(12).toString('hex');
}

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

@Injectable()
export class CategoryService {
  private items = new Map<string, Category>();

  list(): Category[] {
    return [...this.items.values()].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }

  get(id: string): Category {
    const c = this.items.get(id);
    if (!c) throw new Error('not found');
    return c;
  }

  create(dto: CreateCategoryDto): Category {
    if (!dto.name?.trim()) throw new Error('name is required');
    const now = new Date().toISOString();
    const slug = (dto.slug?.trim() || slugify(dto.name)) || `danh-muc-${Date.now().toString(36)}`;
    if ([...this.items.values()].some((c) => c.slug === slug)) throw new Error('slug already exists');
    if (dto.parentId && !this.items.has(dto.parentId)) throw new Error('parent not found');
    const c: Category = {
      id: `cat-${Date.now().toString(36)}${randomBytes(3).toString('hex')}`,
      publicId: generatePublicId(),
      name: dto.name.trim(),
      slug,
      parentId: dto.parentId ?? null,
      icon: dto.icon,
      thumbnail: dto.thumbnail,
      description: dto.description,
      sortOrder: dto.sortOrder ?? 0,
      isVisible: dto.isVisible ?? true,
      platforms: dto.platforms ?? ['WEB'],
      appliesTo: dto.appliesTo ?? ['phim', 'video'],
      createdAt: now,
      updatedAt: now,
    };
    this.items.set(c.id, c);
    return c;
  }

  update(id: string, dto: Partial<CreateCategoryDto>): Category {
    const c = this.get(id);
    if (dto.name !== undefined) {
      if (!dto.name.trim()) throw new Error('name is required');
      c.name = dto.name.trim();
    }
    if (dto.slug !== undefined) {
      const slug = dto.slug.trim() || slugify(c.name);
      if ([...this.items.values()].some((x) => x.id !== id && x.slug === slug))
        throw new Error('slug already exists');
      c.slug = slug;
    }
    if (dto.parentId !== undefined) {
      if (dto.parentId && (dto.parentId === id || !this.items.has(dto.parentId)))
        throw new Error('invalid parent');
      c.parentId = dto.parentId;
    }
    if (dto.icon !== undefined) c.icon = dto.icon;
    if (dto.thumbnail !== undefined) c.thumbnail = dto.thumbnail;
    if (dto.description !== undefined) c.description = dto.description;
    if (dto.sortOrder !== undefined) c.sortOrder = dto.sortOrder;
    if (dto.isVisible !== undefined) c.isVisible = dto.isVisible;
    if (dto.platforms !== undefined) c.platforms = dto.platforms;
    if (dto.appliesTo !== undefined) c.appliesTo = dto.appliesTo;
    c.updatedAt = new Date().toISOString();
    return c;
  }

  remove(id: string): { id: string } {
    if (!this.items.has(id)) throw new Error('not found');
    if ([...this.items.values()].some((c) => c.parentId === id))
      throw new Error('category has children');
    this.items.delete(id);
    return { id };
  }
}
