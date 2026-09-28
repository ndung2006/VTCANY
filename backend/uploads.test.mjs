import test from 'node:test';
import assert from 'node:assert/strict';
import { chunkCount, planUpload } from './dist/modules/uploads/upload.plan.js';

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
