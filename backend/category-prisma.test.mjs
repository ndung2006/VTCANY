import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CategoryService } from './dist/modules/admin/category.service.js';

// Fake Prisma cho model Category.
function fakePrisma() {
  const rows = new Map();
  return {
    category: {
      count: async ({ where } = {}) =>
        [...rows.values()].filter((r) => !where || Object.entries(where).every(([k, v]) => r[k] === v)).length,
      findMany: async ({ where, orderBy } = {}) => {
        let all = [...rows.values()];
        if (where) all = all.filter((r) => Object.entries(where).every(([k, v]) => r[k] === v));
        return all;
      },
      findUnique: async ({ where }) =>
        [...rows.values()].find((r) => Object.entries(where).every(([k, v]) => r[k] === v)) || null,
      create: async ({ data }) => { rows.set(data.id, { ...data }); return rows.get(data.id); },
      update: async ({ where, data }) => { const r = rows.get(where.id); Object.assign(r, data); return r; },
      delete: async ({ where }) => { rows.delete(where.id); },
    },
  };
}

test('CategoryService seed du 26 danh muc VTCPlay khi bang trong', async () => {
  const svc = new CategoryService(fakePrisma());
  await svc.onModuleInit();
  const all = await svc.list();
  assert.equal(all.length, 26);
  const byType = (t) => all.filter((c) => c.appliesTo.includes(t)).map((c) => c.name);
  assert.deepEqual(byType('phim'), ['Phim THVL', 'Phim chiếu rạp', 'Phim mới', 'Gameshow', 'Phim hoạt hình', 'Phim SCTV', 'Phim lẻ', 'Phim Bộ']);
  assert.deepEqual(byType('video'), ['World Cup 2026 - Chào buổi sáng', 'KICK - OFF Thể thao', 'Tin thể thao trong nước', 'Check in Việt Nam', 'Thuốc Nam cho người Việt', 'Bản tin dự báo thời tiết', 'Tin tức ANTV', 'Hoạt hình']);
  assert.deepEqual(byType('short'), ['Phim Ngắn', 'Check in Việt Nam', 'Short videos', 'Thời trang', 'Lịch sử', 'Tin tức', 'Kỹ năng số', 'Động vật']);
  assert.deepEqual(byType('truyen-hinh'), ['Tin tức', 'Thể thao']);
  // Seed lan 2 khong tao trung
  await svc.onModuleInit();
  assert.equal((await svc.list()).length, 26);
});

test('listVisible(type) chi tra danh muc hien thi dung loai', async () => {
  const svc = new CategoryService(fakePrisma());
  await svc.onModuleInit();
  const phim = await svc.listVisible('phim');
  assert.equal(phim.length, 8);
  assert.ok(phim.every((c) => c.isVisible));
  const one = phim[0];
  await svc.update(one.id, { isVisible: false });
  assert.equal((await svc.listVisible('phim')).length, 7);
  // khong truyen type -> tra het
  assert.equal((await svc.listVisible()).length, 25);
});

test('Category CRUD: tao/trung slug/sua/xoa + chan xoa khi co con', async () => {
  const svc = new CategoryService(fakePrisma());
  const c = await svc.create({ name: 'Test Cat', appliesTo: ['phim'] });
  assert.equal(c.slug, 'test-cat');
  await assert.rejects(svc.create({ name: 'Test Cat', appliesTo: ['phim'] }), /slug already exists/);
  const u = await svc.update(c.id, { name: 'Doi ten' });
  assert.equal(u.name, 'Doi ten');
  assert.equal(u.slug, 'test-cat'); // khong doi slug khi khong truyen
  const child = await svc.create({ name: 'Con', parentId: c.id, appliesTo: ['phim'] });
  await assert.rejects(svc.remove(c.id), /has children/);
  await svc.remove(child.id);
  await svc.remove(c.id);
  await assert.rejects(svc.get(c.id), /not found/);
});
