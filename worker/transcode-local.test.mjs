import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFileSync } from 'fs';
import { transcodeLocal } from './dist/transcode-local.js';

test('local transcode outputs a playlist without ffmpeg', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'vtc-'));
  const raw = join(dir, 'a.mp4');
  writeFileSync(raw, Buffer.from('fake-video-bytes'));
  const r = await transcodeLocal(raw, join(dir, 'hls'));
  assert.equal(existsSync(r.playlist), true);
});
