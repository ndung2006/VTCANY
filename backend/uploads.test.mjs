import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { chunkCount, planUpload } from './dist/modules/uploads/upload.plan.js';
import { UploadsService } from './dist/modules/uploads/uploads.service.js';
import { Readable } from 'stream';

function svcWithTmp() {
  const dir = mkdtempSync(join(tmpdir(), 'vtc-upl-'));
  const cfg = { get: (k, d) => (k === 'STORAGE_DIR' ? dir : d) };
  return new UploadsService(cfg);
}

test('5GiB file splits into 1024 chunks of 5MiB', () => {
  assert.equal(chunkCount(5 * 1024 * 1024 * 1024), 1024);
});

test('oversize file rejected before touching storage', () => {
  assert.throws(() => planUpload('a.mp4', 11 * 1024 * 1024 * 1024, 'video/mp4'), /too large/);
});

test('plan keeps video link for later publish', () => {
  const rec = planUpload('show.mp4', 100 * 1024 * 1024, 'video/mp4', 'vid-1');
  assert.equal(rec.status, 'pending');
  assert.equal(rec.chunks, 20);
  assert.equal(rec.videoId, 'vid-1');
});

test('chunk upload -> complete -> webhook done maps video to hls path', async () => {
  const svc = svcWithTmp();
  const rec = await svc.init('demo.mp4', 3, 'video/mp4', 'vid-9');
  await svc.putChunk(rec.id, 0, Readable.from([Buffer.from('ABC')]));
  const done = svc.complete(rec.id);
  assert.equal(done.status, 'processing');
  svc.markDone(rec.id);
  const mapped = svc.setVideoReady(rec.id);
  assert.equal(mapped.hlsPath, `/media/${rec.id}/master.m3u8`);
  assert.equal(svc.videoPlay('vid-9').hls_path, `/media/${rec.id}/master.m3u8`);
});

test('video without finished vod has no play link', () => {
  const svc = svcWithTmp();
  assert.throws(() => svc.videoPlay('vid-missing'), /vod not ready/);
});

test('transcode queue lists only processing jobs with localPath', async () => {
  const svc = svcWithTmp();
  const a = await svc.init('a.mp4', 3, 'video/mp4');
  await svc.putChunk(a.id, 0, Readable.from([Buffer.from('A')]));
  svc.complete(a.id);
  const b = await svc.init('b.mp4', 3, 'video/mp4');
  const q = svc.pendingTranscode();
  assert.equal(q.length, 1);
  assert.equal(q[0].id, a.id);
  assert.match(q[0].localPath, /a\.mp4$/);
  void b;
});
