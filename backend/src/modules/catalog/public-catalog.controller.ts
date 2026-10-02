import { Controller, Get, HttpException, HttpStatus, Param, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CategoryService } from '../admin/category.service';

// API doc cong khai cho apps/web (khong can dang nhap): GET /api/v1/catalog/shorts|videos|movies
// Chi tra noi dung da xuat ban (isVisible !== false), danh tinh cong khai la
// public_id 24-hex; URL phat lay rieng qua /api/v1/vod/:kind/:id/play.
// Tab /phim|/video|/short hien thi rail theo tung danh muc cua loai do.
@Controller('catalog')
export class PublicCatalogController {
  constructor(private catalog: CatalogService, private categories: CategoryService) {}

  // Danh muc cong khai theo loai noi dung: ?type=phim|video|short|truyen-hinh
  @Get('categories')
  async listCategories(@Query('type') type?: string) {
    const cats = await this.categories.listVisible(type || undefined);
    return {
      data: cats.map((c) => ({ id: c.id, public_id: c.publicId, name: c.name, slug: c.slug })),
    };
  }

  @Get('shorts')
  listShorts(@Query('page') page?: string, @Query('limit') limit?: string, @Query('categoryId') categoryId?: string) {
    return this.catalog.listPublic('shorts', { page: Number(page) || 1, limit: Number(limit) || 24, categoryId });
  }

  @Get('shorts/:publicId')
  async getShort(@Param('publicId') publicId: string) {
    return this.one('shorts', publicId);
  }

  @Get('videos')
  listVideos(@Query('page') page?: string, @Query('limit') limit?: string, @Query('categoryId') categoryId?: string) {
    return this.catalog.listPublic('videos', { page: Number(page) || 1, limit: Number(limit) || 24, categoryId });
  }

  @Get('videos/:publicId')
  async getVideo(@Param('publicId') publicId: string) {
    return this.one('videos', publicId);
  }

  @Get('movies')
  listMovies(@Query('page') page?: string, @Query('limit') limit?: string, @Query('categoryId') categoryId?: string) {
    return this.catalog.listPublic('movies', { page: Number(page) || 1, limit: Number(limit) || 24, categoryId });
  }

  @Get('movies/:publicId')
  async getMovie(@Param('publicId') publicId: string) {
    return this.one('movies', publicId);
  }

  private async one(entity: string, publicId: string) {
    try {
      return await this.catalog.getPublic(entity, publicId);
    } catch {
      throw new HttpException(
        { error: { code: 'not_found', message: 'noi dung khong ton tai hoac chua xuat ban' } },
        HttpStatus.NOT_FOUND,
      );
    }
  }
}
