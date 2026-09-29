import test from 'node:test';
import assert from 'node:assert/strict';
import { LayoutService } from './dist/modules/layout/layout.service.js';

const svc = new LayoutService();
const channels = [
  { name: 'PHUTHO', epgNow: { title: 'Thoi su' } },
  { name: 'HANOI', epgNow: null },
];

test('home returns banner + live rail in order', () => {
  const home = svc.buildHome(channels, [], 'WEB');
  assert.equal(home.platform, 'WEB');
  assert.equal(home.layout_blocks[0].type, 'BANNER_SLIDER');
  assert.equal(home.layout_blocks[1].title, 'Dang phat truc tiep');
  assert.equal(home.layout_blocks[0].items[0].action, 'OPEN_CHANNEL');
  assert.equal(home.layout_blocks[0].items[0].subtitle, 'Thoi su');
});

test('published videos rail appears only when videos exist', () => {
  assert.equal(svc.buildHome(channels, []).layout_blocks.length, 2);
  const withVideos = svc.buildHome(channels, [{ id: 'v1', title: 'Tin' }]);
  assert.equal(withVideos.layout_blocks.length, 3);
  assert.equal(withVideos.layout_blocks[2].items[0].action, 'OPEN_VIDEO');
});
