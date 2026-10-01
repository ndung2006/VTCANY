import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePerms } from '../auth/permissions.decorator';
import { AuditService } from '../audit/audit.service';
import { EpgService } from '../content/epg.service';
import { UploadsService } from '../uploads/uploads.service';
import { END_USERS } from '../auth/users.store';
import { CatalogService } from './catalog.service';

const ENTITIES = [
  'movies', 'videos', 'shorts', 'genres', 'actors', 'playlists',
  'articles', 'events', 'plans', 'notifications', 'keywords',
  'banned', 'livestreams', 'banners', 'rails',
] as const;

@UseGuards(PermissionsGuard)
@Controller('admin/catalog')
export class CatalogController {
  constructor(
    private catalog: CatalogService,
    private audit: AuditService,
    private epg: EpgService,
    private uploads: UploadsService,
  ) {}

  private actor(req: any) {
    return { actor: req.user?.username || 'unknown', role: req.user?.role };
  }

  private bad(e: any) {
    const msg = e?.message || 'bad request';
    const code = msg === 'not found' ? 'not_found' : msg === 'unknown entity' ? 'unknown_entity' : 'bad_request';
    const status = msg === 'not found' ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST;
    throw new HttpException({ error: { code, message: msg } }, status);
  }

  private log(req: any, action: string, resource: string, resourceId?: string) {
    try {
      this.audit.record({ at: Date.now(), ...this.actor(req), action: `${resource}.${action}`, resource: resourceId || resource });
    } catch { /* audit khong duoc lam hong request chinh */ }
  }

  // ---- Episodes (nam trong movie) ----
  @RequirePerms('catalog:read')
  @Get('movies/:id/episodes')
  async listEpisodes(@Param('id') id: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    try {
      return await this.catalog.listEpisodes(id, Number(page) || 1, Number(limit) || 20);
    } catch (e) { this.bad(e); }
  }

  @RequirePerms('catalog:write')
  @Post('movies/:id/episodes')
  async createEpisode(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    try {
      const ep = await this.catalog.createEpisode(id, body || {});
      this.log(req, 'create', 'episodes', ep.id);
      return ep;
    } catch (e) { this.bad(e); }
  }

  @RequirePerms('catalog:write')
  @Patch('episodes/:id')
  async updateEpisode(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    try {
      const ep = await this.catalog.updateEpisode(id, body || {});
      this.log(req, 'update', 'episodes', id);
      return ep;
    } catch (e) { this.bad(e); }
  }

  @RequirePerms('catalog:write')
  @Delete('episodes/:id')
  async deleteEpisode(@Param('id') id: string, @Req() req: any) {
    try {
      await this.catalog.deleteEpisode(id);
      this.log(req, 'delete', 'episodes', id);
      return { ok: true };
    } catch (e) { this.bad(e); }
  }

  // ---- Xuat ban / an noi dung (VOD) ----
  @RequirePerms('catalog:write')
  @Post('episodes/:id/publish')
  async publishEpisode(@Param('id') id: string, @Req() req: any) {
    try {
      const ep = await this.catalog.setEpisodePublished(id, true);
      this.log(req, 'publish', 'episodes', id);
      return ep;
    } catch (e) { this.bad(e); }
  }

  @RequirePerms('catalog:write')
  @Post('episodes/:id/unpublish')
  async unpublishEpisode(@Param('id') id: string, @Req() req: any) {
    try {
      const ep = await this.catalog.setEpisodePublished(id, false);
      this.log(req, 'unpublish', 'episodes', id);
      return ep;
    } catch (e) { this.bad(e); }
  }

  @RequirePerms('catalog:write')
  @Post(':entity/:id/publish')
  async publish(@Param('entity') entity: string, @Param('id') id: string, @Req() req: any) {
    try {
      const item = await this.catalog.setPublished(entity, id, true);
      this.log(req, 'publish', entity, id);
      return item;
    } catch (e) { this.bad(e); }
  }

  @RequirePerms('catalog:write')
  @Post(':entity/:id/unpublish')
  async unpublish(@Param('entity') entity: string, @Param('id') id: string, @Req() req: any) {
    try {
      const item = await this.catalog.setPublished(entity, id, false);
      this.log(req, 'unpublish', entity, id);
      return item;
    } catch (e) { this.bad(e); }
  }

  // ---- Settings ----
  @RequirePerms('catalog:read')
  @Get('settings/all')
  async getSettings() {
    return this.catalog.getSettings();
  }

  @RequirePerms('catalog:write')
  @Put('settings/all')
  async putSettings(@Body() body: any, @Req() req: any) {
    const s = await this.catalog.putSettings(body || {});
    this.log(req, 'update', 'settings');
    return s;
  }

  // ---- Media library (Tap tin) ----
  @RequirePerms('catalog:read')
  @Get('files/all')
  listFiles(@Query('page') page?: string, @Query('limit') limit?: string) {
    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(100, Math.max(1, Number(limit) || 20));
    const all = this.uploads.listUploads();
    return { data: all.slice((p - 1) * l, p * l), meta: { page: p, limit: l, total: all.length } };
  }

  // ---- Analytics ----
  @RequirePerms('catalog:read')
  @Get('analytics/summary')
  async summary() {
    // Dem user/channel that su lieu hien co; bieu do dang ky dung mock on dinh.
    return {
      ...(await this.catalog.summary({ users: END_USERS.length, channels: 0 })),
      registrations7d: [3, 5, 2, 6, 4, 7, 5],
    };
  }

  // ---- EPG: template + import CSV ----
  @RequirePerms('epg:read')
  @Get('epg/template')
  template(@Res() res: Response) {
    const csv = 'ten_chuong_trinh,noi_dung,bat_dau,ket_thuc,xem_lai\n"Thoi su 19h","Ban tin thoi su",19:00,19:45,1\n"Phim truyen","Tap 12",20:00,21:00,0\n';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="epg-template.csv"');
    res.send('﻿' + csv);
  }

  @RequirePerms('epg:write')
  @Post('channels/:id/epg/import')
  @UseInterceptors(FileInterceptor('file'))
  importEpg(@Param('id') id: string, @UploadedFile() file: any, @Query('date') date: string, @Req() req: any) {
    try {
      if (!file?.buffer) throw new Error('file is required (multipart field "file")');
      const text = file.buffer.toString('utf8').replace(/^\uFEFF/, '');
      const lines = text.split(/\r?\n/).filter((l: string) => l.trim());
      if (lines.length < 2) throw new Error('file trong hoac thieu dong tieu de');
      const items = lines.slice(1).map((line: string) => {
        // CSV don gian: ho tro dau phay trong ngoac kep
        const cols = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)?.map((c) => c.replace(/^"|"$/g, '').trim()) || [];
        return {
          title: cols[0] || 'Chuong trinh',
          description: cols[1] || '',
          time: cols[2] || '00:00',
          end: cols[3] || '',
          status: cols[4] === '1' ? 'REPLAY' : 'UPCOMING',
        } as any;
      });
      const saved = this.epg.set(id, items, date);
      this.log(req, 'import', 'epg', id);
      return { ok: true, channelId: id, date: date || 'default', imported: saved.length };
    } catch (e) { this.bad(e); }
  }

  // ---- Generic CRUD ----
  @RequirePerms('catalog:read')
  @Get(':entity')
  async list(@Param('entity') entity: string, @Query('page') page?: string, @Query('limit') limit?: string, @Query('q') q?: string) {
    try {
      return await this.catalog.list(entity, { page: Number(page) || 1, limit: Number(limit) || 20, q });
    } catch (e) { this.bad(e); }
  }

  @RequirePerms('catalog:write')
  @Post(':entity')
  async create(@Param('entity') entity: string, @Body() body: any, @Req() req: any) {
    try {
      const item = await this.catalog.create(entity, body || {});
      this.log(req, 'create', entity, item.id);
      return item;
    } catch (e) { this.bad(e); }
  }

  @RequirePerms('catalog:read')
  @Get(':entity/:id')
  async getOne(@Param('entity') entity: string, @Param('id') id: string) {
    try {
      return await this.catalog.get(entity, id);
    } catch (e) { this.bad(e); }
  }

  @RequirePerms('catalog:write')
  @Patch(':entity/:id')
  async update(@Param('entity') entity: string, @Param('id') id: string, @Body() body: any, @Req() req: any) {
    try {
      const item = await this.catalog.update(entity, id, body || {});
      this.log(req, 'update', entity, id);
      return item;
    } catch (e) { this.bad(e); }
  }

  @RequirePerms('catalog:write')
  @Delete(':entity/:id')
  async remove(@Param('entity') entity: string, @Param('id') id: string, @Req() req: any) {
    try {
      await this.catalog.remove(entity, id);
      this.log(req, 'delete', entity, id);
      return { ok: true };
    } catch (e) { this.bad(e); }
  }

}
