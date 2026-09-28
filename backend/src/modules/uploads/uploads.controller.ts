import { Body, Controller, Get, Headers, HttpException, HttpStatus, Param, Post, Put, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePerms } from '../auth/permissions.decorator';
import { UploadsService } from './uploads.service';

class InitUploadDto {
  @IsString()
  filename!: string;
  @IsInt()
  @Min(1)
  sizeBytes!: number;
  @IsOptional()
  @IsString()
  contentType?: string;
  @IsOptional()
  @IsString()
  videoId?: string;
}

@Controller()
export class UploadsController {
  constructor(private uploads: UploadsService) {}

  // CMS (editor+): xin URL upload. File di thang len storage, khong qua backend.
  @UseGuards(PermissionsGuard)
  @RequirePerms('video:create')
  @Post('uploads/init')
  init(@Body() dto: InitUploadDto) {
    try {
      return this.uploads.init(dto.filename, dto.sizeBytes, dto.contentType || 'video/mp4', dto.videoId);
    } catch (e: any) {
      throw new HttpException(e?.message || 'invalid upload', HttpStatus.BAD_REQUEST);
    }
  }

  @UseGuards(PermissionsGuard)
  @RequirePerms('video:create')
  @Get('uploads/:id')
  status(@Param('id') id: string) {
    try {
      return this.uploads.get(id);
    } catch {
      throw new HttpException('upload not found', HttpStatus.NOT_FOUND);
    }
  }

  // Nhan chunk nhi phan (application/octet-stream), stream thang ra dia.
  // Khong di qua JSON body parser - file khong lot vao API logic.
  @UseGuards(PermissionsGuard)
  @RequirePerms('video:create')
  @Put('storage-local/raw/:id/chunks/:n')
  async putChunk(@Param('id') id: string, @Param('n') n: string, @Req() req: Request, @Res() res: Response) {
    try {
      const out = await this.uploads.putChunk(id, Number(n), req as any);
      res.json(out);
    } catch (e: any) {
      res.status(HttpStatus.BAD_REQUEST).json({ error: e?.message || 'chunk failed' });
    }
  }

  // Browser bao da nhan du file -> backend day job cho worker.
  @UseGuards(PermissionsGuard)
  @RequirePerms('video:create')
  @Post('uploads/:id/complete')
  complete(@Param('id') id: string) {
    try {
      const rec = this.uploads.complete(id);
      return { ...rec, next: 'worker transcode p480/p720 -> HLS' };
    } catch (e: any) {
      throw new HttpException(e?.message || 'invalid transition', HttpStatus.BAD_REQUEST);
    }
  }

  // Webhook tu storage/FFmpeg cu. Guard bang shared secret, khong dung JWT.
  @Post('internal/media-webhook')
  webhook(@Headers('x-webhook-secret') secret: string, @Body() body: any) {
    if (!this.uploads.checkWebhookSecret(secret || '')) {
      throw new HttpException('forbidden', HttpStatus.FORBIDDEN);
    }
    const { uploadId, status } = body || {};
    if (!uploadId) throw new HttpException('uploadId required', HttpStatus.BAD_REQUEST);
    if (status === 'done') return this.uploads.markDone(uploadId);
    if (status === 'error') return this.uploads.markError(uploadId);
    try {
      return this.uploads.get(uploadId);
    } catch {
      throw new HttpException('upload not found', HttpStatus.NOT_FOUND);
    }
  }
}
