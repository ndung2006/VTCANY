import { join } from 'path';
import { transcodeLocal } from './transcode-local';

// Worker Phase 1: poll backend tim upload dang processing -> transcode local
// -> bao done qua webhook. Chung volume storage voi backend (STORAGE_DIR giong nhau).
// Len Redis: thay poll bang BullMQ subscriber, giu nguyen xu ly tung job.
const BACKEND = (process.env.BACKEND_URL || 'http://localhost:3001/api/v1').replace(/\/$/, '');
const SECRET = process.env.MEDIA_WEBHOOK_SECRET || '';
const STORAGE = process.env.STORAGE_DIR || join(process.cwd(), '..', 'storage');
const POLL_MS = Number(process.env.POLL_MS || 10000);

async function tick() {
  let jobs: any[];
  try {
    const res = await fetch(`${BACKEND}/internal/transcode-queue`, {
      headers: { 'x-webhook-secret': SECRET },
    });
    if (!res.ok) throw new Error(`queue ${res.status}`);
    jobs = await res.json();
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.log('[worker] queue poll failed:', e?.message);
    return;
  }
  for (const job of jobs) {
    // eslint-disable-next-line no-console
    console.log(`[worker] transcode ${job.id} (${job.filename})`);
    try {
      const outDir = join(STORAGE, 'hls', job.id);
      await transcodeLocal(job.localPath, outDir);
      await fetch(`${BACKEND}/internal/media-webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-webhook-secret': SECRET },
        body: JSON.stringify({ uploadId: job.id, status: 'done' }),
      });
      // eslint-disable-next-line no-console
      console.log(`[worker] done ${job.id}`);
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.log(`[worker] error ${job.id}:`, e?.message);
      await fetch(`${BACKEND}/internal/media-webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-webhook-secret': SECRET },
        body: JSON.stringify({ uploadId: job.id, status: 'error' }),
      }).catch(() => undefined);
    }
  }
}

// eslint-disable-next-line no-console
console.log(`[worker] polling ${BACKEND} every ${POLL_MS}ms, storage=${STORAGE}`);
void tick();
setInterval(tick, POLL_MS);
