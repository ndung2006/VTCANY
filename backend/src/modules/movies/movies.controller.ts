import { Controller, Get, HttpException, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MoviesService } from './movies.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { buildTabs } from './movies.catalog';

// Public (ẩn danh xem được). Chỉ /favorite yêu cầu JWT.
@Controller('movies')
export class MoviesController {
  constructor(private movies: MoviesService, private jwt: JwtService) {}

  private optionalUserId(req: any): string | undefined {
    const header: string = req.headers?.authorization || '';
    const [, token] = header.split(' ');
    if (!token) return undefined;
    try {
      const payload = this.jwt.verify(token);
      return payload?.sub;
    } catch {
      return undefined;
    }
  }

  private toHttp(e: any): never {
    const status = e?.status === 404 ? HttpStatus.NOT_FOUND : e?.status === 400 ? HttpStatus.BAD_REQUEST : HttpStatus.INTERNAL_SERVER_ERROR;
    throw new HttpException({ error: { code: status === 404 ? 'not_found' : 'bad_request', message: e?.message } }, status);
  }

  // GET /api/v1/movies/{public_id} (Mục 3B).
  @Get(':publicId')
  detail(@Param('publicId') publicId: string, @Req() req: any) {
    try {
      return this.movies.detail(publicId, this.optionalUserId(req));
    } catch (e) {
      this.toHttp(e);
    }
  }

  @Get(':publicId/episodes')
  episodes(@Param('publicId') publicId: string) {
    try {
      const m = this.movies.get(publicId);
      return { public_id: publicId, tabs: buildTabs(m.total_episodes), episodes: m.episodes };
    } catch (e) {
      this.toHttp(e);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post(':publicId/favorite')
  favorite(@Param('publicId') publicId: string, @Req() req: any) {
    try {
      return this.movies.toggleFavorite(req.user.sub, publicId);
    } catch (e) {
      this.toHttp(e);
    }
  }
}
