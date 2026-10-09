// Test timeshift (xem lai): stitch playlist + absolutize URI — chay sau `npm run build`.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { absolutizeUri, stitchTimeshiftPlaylists, TIMESHIFT_MAX_MS, TIMESHIFT_RETENTION_MS } from './dist/modules/playback/aio-client.js';

test('TIMESHIFT consts: 6h/call, retention 30 ngay', () => {
  assert.equal(TIMESHIFT_MAX_MS, 6 * 3600 * 1000);
  assert.equal(TIMESHIFT_RETENTION_MS, 30 * 24 * 3600 * 1000);
});

test('absolutizeUri: tuong doi -> tuyet doi, tuyet doi giu nguyen', () => {
  const base = 'https://luuchieu1.vtcplay.vn';
  assert.equal(absolutizeUri('/api/timeshift/chunks?file=a.ts', base), 'https://luuchieu1.vtcplay.vn/api/timeshift/chunks?file=a.ts');
  assert.equal(absolutizeUri('seg/1.ts', base), 'https://luuchieu1.vtcplay.vn/seg/1.ts');
  assert.equal(absolutizeUri('https://cdn.x/1.ts', base), 'https://cdn.x/1.ts');
  assert.equal(absolutizeUri('//cdn.x/1.ts', base), '//cdn.x/1.ts');
});

const CHUNK1 = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-PLAYLIST-TYPE:VOD
#EXT-X-START:TIME-OFFSET=0,PRECISE=YES
#EXTINF:10.0,
/api/timeshift/chunks?file=s1.ts&channel=LAICHAU
#EXTINF:10.0,
/api/timeshift/chunks?file=s2.ts&channel=LAICHAU
#EXT-X-ENDLIST
`;

const CHUNK2 = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:12
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-PLAYLIST-TYPE:VOD
#EXTINF:12.0,
https://luuchieu1.vtcplay.vn/api/timeshift/chunks?file=s3.ts
#EXT-X-ENDLIST
`;

test('stitchTimeshiftPlaylists: 1 chunk -> playlist chuan VOD', () => {
  const out = stitchTimeshiftPlaylists([{ playlist: CHUNK1, baseUrl: 'https://luuchieu1.vtcplay.vn' }]);
  assert.ok(out.startsWith('#EXTM3U\n'));
  assert.ok(out.includes('#EXT-X-PLAYLIST-TYPE:VOD'));
  assert.ok(out.includes('#EXT-X-TARGETDURATION:10'));
  assert.ok(out.includes('https://luuchieu1.vtcplay.vn/api/timeshift/chunks?file=s1.ts&channel=LAICHAU'));
  assert.ok(out.includes('#EXT-X-ENDLIST'));
  assert.ok(!out.includes('#EXT-X-START'), 'bo START rieng cua chunk');
  assert.equal((out.match(/#EXTINF/g) || []).length, 2);
});

test('stitchTimeshiftPlaylists: 2 chunk -> DISCONTINUITY giua, TARGETDURATION max', () => {
  const out = stitchTimeshiftPlaylists([
    { playlist: CHUNK1, baseUrl: 'https://luuchieu1.vtcplay.vn' },
    { playlist: CHUNK2, baseUrl: 'https://luuchieu1.vtcplay.vn' },
  ]);
  assert.equal((out.match(/#EXTINF/g) || []).length, 3);
  assert.equal((out.match(/#EXT-X-DISCONTINUITY/g) || []).length, 1);
  assert.ok(out.includes('#EXT-X-TARGETDURATION:12'), 'lay max target duration');
  // thu tu segment giu nguyen
  const i1 = out.indexOf('s1.ts');
  const i3 = out.indexOf('s3.ts');
  assert.ok(i1 < i3);
  assert.equal((out.match(/#EXT-X-ENDLIST/g) || []).length, 1);
});

test('stitchTimeshiftPlaylists: mang theo KEY/MAP', () => {
  const chunk = `#EXTM3U
#EXT-X-KEY:METHOD=AES-128,URI="/key.bin"
#EXT-X-MAP:URI="init.mp4"
#EXTINF:10.0,
seg1.m4s
#EXTINF:10.0,
seg2.m4s
#EXT-X-ENDLIST
`;
  const out = stitchTimeshiftPlaylists([{ playlist: chunk, baseUrl: 'https://a.io' }]);
  assert.ok(out.includes('#EXT-X-KEY:METHOD=AES-128,URI="https://a.io/key.bin"'));
  assert.ok(out.includes('#EXT-X-MAP:URI="https://a.io/init.mp4"'));
  assert.ok(out.includes('https://a.io/seg1.m4s'));
});

test('stitchTimeshiftPlaylists: chunk rong -> chi header + ENDLIST', () => {
  const out = stitchTimeshiftPlaylists([{ playlist: '#EXTM3U\n#EXT-X-ENDLIST\n', baseUrl: 'https://a.io' }]);
  assert.ok(out.includes('#EXT-X-ENDLIST'));
  assert.equal(out.match(/#EXTINF/g), null);
});
