import test from 'node:test';
import assert from 'node:assert/strict';
import { MOVIES, buildTabs } from './dist/modules/movies/movies.catalog.js';
import { MoviesService } from './dist/modules/movies/movies.service.js';

const svc = new MoviesService();
const THAM_TINH = '6925687120dd0e58b0facba3';

test('Tham Tinh: 22 episodes, tabs 10/tab (contract 3B)', () => {
  const d = svc.detail(THAM_TINH);
  assert.equal(d.video_info.title, 'Thâm Tình');
  assert.equal(d.video_info.release_year, 2024);
  assert.equal(d.video_info.total_episodes, '22 / 22 Tập');
  assert.equal(d.episodes.length, 22);
  assert.deepEqual(d.video_info.tabs, ['Tập 1 - Tập 10', 'Tập 11 - Tập 20', 'Tập 21 - Tập cuối']);
  assert.equal(d.video_info.is_favorited, false);
  assert.ok(d.related_videos.length > 0);
  assert.match(d.episodes[0].episode_id, /-e1$/);
});

test('catalog covers all phim rail items (card links resolve)', () => {
  const ids = new Set(MOVIES.map((m) => m.public_id));
  assert.ok(ids.size >= 20);
  for (const m of MOVIES) {
    assert.match(m.public_id, /^[0-9a-f]{24}$/);
    svc.detail(m.public_id); // must not throw
  }
});

test('invalid public_id -> 400, unknown -> 404', () => {
  assert.throws(() => svc.detail('xyz'), /24 hex/);
  assert.throws(() => svc.detail('aaaaaaaaaaaaaaaaaaaaaaaa'), /not found/);
});

test('favorite toggles per user', () => {
  assert.deepEqual(svc.toggleFavorite('u1', THAM_TINH), { is_favorited: true });
  assert.equal(svc.detail(THAM_TINH, 'u1').video_info.is_favorited, true);
  assert.equal(svc.detail(THAM_TINH, 'u2').video_info.is_favorited, false);
  assert.deepEqual(svc.toggleFavorite('u1', THAM_TINH), { is_favorited: false });
});

test('buildTabs edge cases', () => {
  assert.deepEqual(buildTabs(10), ['Tập 1 - Tập 10']);
  assert.deepEqual(buildTabs(11), ['Tập 1 - Tập 10', 'Tập 11 - Tập cuối']);
});
