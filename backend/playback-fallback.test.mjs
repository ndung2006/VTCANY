// Test PlaybackService.mint: fallback sang link xoay tu channel scan khi
// /api/hls-tokens bi tu choi (doi tac chua duoc cap quyen lay link xoay).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PlaybackService } from './dist/modules/playback/playback.service.js';
import { urlExpMs } from './dist/modules/playback/aio-client.js';

const ROTATING = 'https://luuchieu1.vtcplay.vn/hls/ANGIANG1/tc-p720/index.m3u8?token=abc&exp=999';

function stubFetch({ tokensOk }) {
  global.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u.includes('/api/hls-tokens')) {
      if (!tokensOk) {
        return { ok: false, status: 200, json: async () => ({ error: 'đối tác any đã bị tắt quyền lấy link xoay' }) };
      }
      return { ok: true, status: 200, json: async () => ({ token: 't', exp: 123, url: '/hls/ANGIANG1/index.m3u8?token=t&exp=123' }) };
    }
    if (u.includes('/api/public/channels')) {
      return {
        ok: true, status: 200,
        json: async () => ({
          baseUrl: 'https://luuchieu1.vtcplay.vn',
          channels: [{
            name: 'ANGIANG1', status: 'RUNNING', live: true,
            hlsTranscodeRotating: [{ preset: 'p480', hls: 'https://x/p480.m3u8' }, { preset: 'p720', hls: ROTATING }],
          }],
        }),
      };
    }
    throw new Error('unexpected fetch ' + u);
  };
}

function svc() {
  const fakeConfig = { get: (k, d) => (k === 'PLAYBACK_TTL_MINUTES' ? 240 : d) };
  const fakeSources = { getActiveConfig: async () => ({ baseUrl: 'https://luuchieu1.vtcplay.vn', partnerKey: 'k' }) };
  return new PlaybackService(fakeConfig, fakeSources);
}

test('mint: /api/hls-tokens OK -> dung master url nhu cu', async () => {
  stubFetch({ tokensOk: true });
  const r = await svc().mint('ANGIANG1');
  assert.equal(r.hls_url, 'https://luuchieu1.vtcplay.vn/api/hls/ANGIANG1/master.m3u8?token=t&exp=123');
});

test('mint: /api/hls-tokens bi tu choi quyen -> fallback link xoay p720 tu scan', async () => {
  stubFetch({ tokensOk: false });
  const r = await svc().mint('ANGIANG1');
  assert.equal(r.hls_url, ROTATING);
  assert.ok(r.ttl_seconds > 0);
});

test('mint: ca hai deu hong -> nem loi goc', async () => {
  global.fetch = async (url) => {
    if (String(url).includes('/api/public/channels')) {
      return { ok: true, status: 200, json: async () => ({ channels: [] }) };
    }
    return { ok: false, status: 200, json: async () => ({ error: 'doi tac bi tat quyen' }) };
  };
  await assert.rejects(svc().mint('KHONGCO'), /aio: http 200|bad token/);
});

test('urlExpMs: doc han that tu query param exp (ms)', () => {
  assert.equal(urlExpMs('https://x/api/hls/A/master.m3u8?token=t&exp=1791297224343'), 1791297224343);
});

test('urlExpMs: exp dang giay -> doi sang ms', () => {
  assert.equal(urlExpMs('https://x/api/hls/A/master.m3u8?exp=1791297224'), 1791297224000);
});

test('urlExpMs: khong co exp -> null', () => {
  assert.equal(urlExpMs('https://x/api/hls/A/master.m3u8?token=t'), null);
  assert.equal(urlExpMs('https://x/api/hls/A/master.m3u8'), null);
});

test('mint: uu tien exp trong URL thay vi exp khong dang tin trong body', async () => {
  global.fetch = async (url) => {
    if (String(url).includes('/api/hls-tokens')) {
      return {
        ok: true, status: 200,
        json: async () => ({ token: 't', exp: 111, url: '/hls/ANGIANG1/index.m3u8?token=t&exp=1791297224343' }),
      };
    }
    throw new Error('unexpected fetch ' + url);
  };
  const r = await svc().mint('ANGIANG1');
  assert.equal(r.exp, 1791297224343);
});
