import { Controller, Get, HttpException, HttpStatus, Param, Query, Req } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TvService } from './tv.service';
import { hasPermission, Role } from '../auth/users.store';

// Public cho web (public_id 24hex). Slug tên kênh (CMS) vẫn yêu cầu quyền epg:read.
// Handler duy nhất để tránh xung đột route với ContentController.
@Controller('channels')
export class TvController {
  constructor(private tv: TvService, private jwt: JwtService) {}

  // GET /api/v1/channels (Mục 3C).
  @Get()
  async groups() {
    return this.tv.listGroups();
  }

  // GET /api/v1/channels/{publicId}/epg?date=YYYY-MM-DD (Mục 3C, public).
  // GET /api/v1/channels/{slug}/epg (CMS cũ, cần quyền).
  @Get(':id/epg')
  async epg(@Param('id') id: string, @Query('date') date: string | undefined, @Req() req: any) {
    if (/^[0-9a-f]{24}$/.test(id)) {
      try {
        return await this.tv.epg(id, date);
      } catch (e: any) {
        const status = e?.status === 404 ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST;
        throw new HttpException({ error: { code: status === 404 ? 'not_found' : 'bad_request', message: e?.message } }, status);
      }
    }
    const role = this.optionalRole(req);
    if (!role) throw new HttpException('missing bearer token', HttpStatus.UNAUTHORIZED);
    if (!hasPermission(role as Role, 'epg:read')) throw new HttpException('forbidden', HttpStatus.FORBIDDEN);
    return this.tv.cmsEpgBySlug(id, date);
  }

  private optionalRole(req: any): string | undefined {
    const header: string = req.headers?.authorization || '';
    const [, token] = header.split(' ');
    if (!token) return undefined;
    try {
      return this.jwt.verify(token)?.role;
    } catch {
      return undefined;
    }
  }
}
