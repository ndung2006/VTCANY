import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RateLimitGuard } from '../auth/rate-limit.guard';
import { PlaybackService } from './playback.service';

class MintTokenDto {
  @IsIn(['live', 'vod'])
  type!: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  video_id?: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(15)
  ttlMinutes?: number;
}

@Controller('playback')
export class PlaybackController {
  constructor(private playback: PlaybackService) {}

  // Phase 1: JWT user/pass required. No subscription check yet.
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @Post('token')
  token(@Body() dto: MintTokenDto) {
    const channel = dto.type === 'live' ? (dto.slug || 'PHUTHO') : `VOD_${dto.video_id || 'unknown'}`;
    return this.playback.mint(channel.toUpperCase(), dto.ttlMinutes);
  }
}
