import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { transcodeLocal } from './dist/transcode-local.js';

function hasFfmpeg() {
  return new Promise((resolve) => execFile('ffmpeg', ['-version'], (err) => resolve(!err)));
}

function makeMp4(out) {
  return new Promise((resolve, reject) => {
    execFile(
      'ffmpeg',
      ['-y', '-f', 'lavfi', '-i', 'testsrc=duration=2:size=320x240:rate=10', '-pix_fmt', 'yuv420p', out],
      (err) => (err ? reject(err) : resolve()),
    );
  });
}

test('pipeline: mp4 that -> HLS master.m3u8 + segments (ffmpeg that)', async (t) => {
  if (!(await hasFfmpeg())) {
    t.skip('ffmpeg khong co san');
    return;
  }
  const dir = mkdtempSync(join(tmpdir(), 'vtc-pipe-'));
  const src = join(dir, 'in.mp4');
  await makeMp4(src);
  assert.ok(existsSync(src), 'mp4 test duoc tao');

  const hlsDir = join(dir, 'hls');
  const res = await transcodeLocal(src, hlsDir);
  assert.equal(res.simulated, false);
  assert.ok(existsSync(res.playlist), 'master.m3u8 ton tai');

  const m3u8 = readFileSync(res.playlist, 'utf8');
  assert.ok(m3u8.includes('#EXTM3U'), 'playlist hop le');
  const files = readdirSync(hlsDir);
  const segs = files.filter((f) => f.endsWith('.ts'));
  assert.ok(segs.length > 0, `co segment .ts (thay ${segs.length})`);
});

test('pipeline: raw khong ton tai -> throw de worker retry', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'vtc-pipe-'));
  await assert.rejects(() => transcodeLocal(join(dir, 'nope.mp4'), join(dir, 'hls')), /raw not found/);
});

test('queue interface giu nguyen (enqueue/status) cho BullMQ/poll', async () => {
  const { JobQueue } = await import('./dist/queue.js');
  const q = new JobQueue();
  const job = q.enqueue('s3://raw/a.mp4', ['p480', 'p720']);
  assert.equal(job.status, 'queued');
  assert.deepEqual(job.presets, ['p480', 'p720']);
  q.mark(job.id, 'processing');
  q.mark(job.id, 'done');
  assert.deepEqual(q.pending(), []);
});
