import { Injectable } from '@nestjs/common';

export interface EpgItem {
  time: string; // HH:mm
  title: string;
  status: 'LIVE' | 'UPCOMING' | 'REPLAY';
}

// Key theo kenh + ngay (YYYY-MM-DD) de CMS nhap lich nhieu ngay.
// Khong truyen date = lich mac dinh (live hien tai).
@Injectable()
export class EpgService {
  private store = new Map<string, EpgItem[]>([
    ['PHUTHO:default', [{ time: 'now', title: 'Live', status: 'LIVE' }]],
  ]);

  private key(slug: string, date?: string): string {
    return `${slug.toUpperCase()}:${date || 'default'}`;
  }

  get(slug: string, date?: string): EpgItem[] {
    return this.store.get(this.key(slug, date)) || [];
  }

  set(slug: string, timeline: EpgItem[], date?: string): EpgItem[] {
    this.store.set(this.key(slug, date), timeline);
    return timeline;
  }
}
