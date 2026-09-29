import test from 'node:test';
import assert from 'node:assert/strict';
import { clampTtlMinutes, fullUrl, mintToken, toMasterUrl } from './dist/modules/playback/aio-client.js';

function mockFetch(handler) {
  globalThis.fetch = handler;
}

test('master url moves to /api/hls keeping query', () => {
  assert.equal(
    toMasterUrl('/hls/PHUTHO/index.m3u8?token=abc&exp=123'),
    '/api/hls/PHUTHO/master.m3u8?token=abc&exp=123',
  );
});

test('ttl clamps 5..1440, default 240', () => {
  assert.equal(clampTtlMinutes(1), 5);
  assert.equal(clampTtlMinutes(240), 240);
  assert.equal(clampTtlMinutes(9999), 1440);
  assert.equal(clampTtlMinutes(NaN), 240);
});

test('mint posts channel+ttl and builds full master url', async () => {
  let seen = null;
  mockFetch(async (url, init) => {
    seen = { url, body: JSON.parse(init.body), auth: init.headers.Authorization };
    return { ok: true, status: 200, json: async () => ({ token: 't', exp: 9, url: '/hls/PHUTHO/index.m3u8?token=t&exp=9' }) };
  });
  const t = await mintToken({ baseUrl: 'https://vtcaio.vtctech.xyz', partnerKey: 'k' }, 'phutho', 240);
  assert.equal(seen.body.channel, 'PHUTHO');
  assert.equal(seen.body.ttlMinutes, 240);
  assert.equal(seen.auth, 'Bearer k');
  assert.equal(fullUrl('https://vtcaio.vtctech.xyz', toMasterUrl(t.url)), 'https://vtcaio.vtctech.xyz/api/hls/PHUTHO/master.m3u8?token=t&exp=9');
});

test('401 maps to invalid partner key', async () => {
  mockFetch(async () => ({ ok: false, status: 401, json: async () => ({}) }));
  await assert.rejects(mintToken({ baseUrl: 'https://x', partnerKey: 'bad' }, 'PHUTHO', 240), /invalid partner key/);
});

test('missing key fails before network', async () => {
  let called = false;
  mockFetch(async () => { called = true; return { ok: true, status: 200, json: async () => ({}) }; });
  await assert.rejects(mintToken({ baseUrl: 'https://x', partnerKey: '' }, 'PHUTHO', 240), /not configured/);
  assert.equal(called, false);
});
