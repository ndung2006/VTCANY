import { Controller, Get, Param, Query } from '@nestjs/common';
import { LayoutService } from './layout.service';
import { PlaybackService } from '../playback/playback.service';
import { ContentService } from '../content/content.service';
import { EpgService } from '../content/epg.service';

// Public (khong JWT): trang chu + chi tiet kenh la noi dung mo.
@Controller()
export class LayoutController {
  constructor(
    private layout: LayoutService,
    private playback: PlaybackService,
    private content: ContentService,
    private epg: EpgService,
  ) {}

  @Get('layout/home')
  async home(@Query('platform') platform?: string) {
    // AIO loi -> van tra rail local (trang chu khong bao gio trang tay).
    let channels: Array<{ name: string; epgNow?: { title: string } | null }> = [];
    try {
      const res = await this.playback.listChannels();
      channels = res.channels.map((c) => ({ name: c.name, epgNow: c.epgNow as any }));
    } catch {
      channels = [];
    }
    const videos = this.content.list().filter((v) => v.status === 'published');
    return this.layout.buildHome(channels, videos, (platform || 'WEB').toUpperCase());
  }

  @Get('channels/:slug/detail')
  async detail(@Param('slug') slug: string, @Query('date') date?: string) {
    const name = slug.toUpperCase();
    let epgNow: unknown = null;
    try {
      epgNow = await this.playback.channelNow(name);
    } catch {
      epgNow = null;
    }
    const audioOnly = await this.playback.channelAudioOnly(name);
    return {
      channel: { name, slug },
      audioOnly,
      epgNow,
      date: date || 'default',
      timeline: this.epg.get(name, date),
      // Link play lay rieng qua POST /playback/token (het han theo TTL).
      play: { via: 'POST /api/v1/playback/token {type:live, slug}' },
    };
  }
}
