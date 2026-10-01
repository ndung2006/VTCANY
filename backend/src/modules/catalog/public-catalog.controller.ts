import { Controller, Get, HttpException, HttpStatus, Param, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';

// API doc cong khai cho apps/web (khong can dang nhap): GET /api/v1/catalog/shorts|videos
// Chi tra noi dung da xuat ban (isVisible !== false), danh tinh cong khai la
// public_id 24-hex; URL phat lay rieng qua /api/v1/vod/:kind/:id/play.
@Controller('catalog')
export class PublicCatalogController {
  constructor(private catalog: CatalogService) {}

  @Get('shorts')
  listShorts(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.catalog.listPublic('shorts', { page: Number(page) || 1, limit: Number(limit) || 24 });
  }

  @Get('shorts/:publicId')
  async getShort(@Param('publicId') publicId: string) {
    return this.one('shorts', publicId);
  }

  @Get('videos')
  listVideos(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.catalog.listPublic('videos', { page: Number(page) || 1, limit: Number(limit) || 24 });
  }

  @Get('videos/:publicId')
  async getVideo(@Param('publicId') publicId: string) {
    return this.one('videos', publicId);
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
