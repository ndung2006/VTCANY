import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHlsUrl, clampTtlMinutes, signToken, verifyToken } from './dist/modules/playback/hls-sign.util.js';

test('sign is deterministic hex64 for channel.exp', () => {
  const t1 = signToken('s3cret', 'PHUTHO', 1790583022339);
  const t2 = signToken('s3cret', 'PHUTHO', 1790583022339);
  assert.equal(t1, t2);
  assert.match(t1, /^[0-9a-f]{64}$/);
});

test('different channel invalidates token', () => {
  const t = signToken('s3cret', 'PHUTHO', 123);
  assert.equal(verifyToken('s3cret', undefined, 'HANOI', 123, t), false);
  assert.equal(verifyToken('s3cret', undefined, 'PHUTHO', 123, t), true);
});

test('previous secret allows rotation without downtime', () => {
  const t = signToken('old-secret', 'PHUTHO', 123);
  assert.equal(verifyToken('new-secret', 'old-secret', 'PHUTHO', 123, t), true);
});

test('ttl clamp 5..1440', () => {
  assert.equal(clampTtlMinutes(1), 5);
  assert.equal(clampTtlMinutes(10), 10);
  assert.equal(clampTtlMinutes(9999), 1440);
});

test('builds canonical /hls/ url', () => {
  const url = buildHlsUrl('https://vtcaio.vtctech.xyz/', 'PHUTHO', 'abc', 123);
  assert.equal(url, 'https://vtcaio.vtctech.xyz/hls/PHUTHO/master.m3u8?token=abc&exp=123');
});
