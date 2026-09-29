import { Injectable } from '@nestjs/common';

export interface HomeBlock {
  order: number;
  type: 'BANNER_SLIDER' | 'HORIZONTAL_LIST';
  title?: string;
  items: Array<{
    id: string;
    title: string;
    subtitle?: string;
    thumbnail?: string | null;
    action: 'OPEN_CHANNEL' | 'OPEN_VIDEO';
    target_id: string;
  }>;
}

// Server-Driven UI: CMS/AIO doi danh muc, Web/App tu doi theo ma khong sua code.
@Injectable()
export class LayoutService {
  buildHome(
    channels: Array<{ name: string; epgNow?: { title: string } | null }>,
    videos: Array<{ id: string; title: string }>,
    platform = 'WEB',
  ): { platform: string; layout_blocks: HomeBlock[] } {
    const live = channels.slice(0, 8);
    const blocks: HomeBlock[] = [
      {
        order: 1,
        type: 'BANNER_SLIDER',
        items: live.slice(0, 5).map((c) => ({
          id: `banner-${c.name}`,
          title: c.name,
          subtitle: c.epgNow?.title || 'Live',
          thumbnail: null,
          action: 'OPEN_CHANNEL' as const,
          target_id: c.name,
        })),
      },
      {
        order: 2,
        type: 'HORIZONTAL_LIST',
        title: 'Dang phat truc tiep',
        items: live.map((c) => ({
          id: c.name,
          title: c.name,
          subtitle: c.epgNow?.title || 'Live',
          thumbnail: null,
          action: 'OPEN_CHANNEL' as const,
          target_id: c.name,
        })),
      },
    ];
    if (videos.length > 0) {
      blocks.push({
        order: 3,
        type: 'HORIZONTAL_LIST',
        title: 'Moi xuat ban',
        items: videos.slice(0, 10).map((v) => ({
          id: v.id,
          title: v.title,
          thumbnail: null,
          action: 'OPEN_VIDEO' as const,
          target_id: v.id,
        })),
      });
    }
    return { platform, layout_blocks: blocks };
  }
}
