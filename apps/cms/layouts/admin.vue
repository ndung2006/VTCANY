<template>
  <div class="flex min-h-screen">
    <aside class="w-60 shrink-0 bg-admin p-4 text-neutral-200">
      <NuxtLink to="/" class="flex items-center gap-2 px-2 py-3">
        <img src="/logo.svg" alt="VTC ANY" width="120" height="50" />
      </NuxtLink>
      <nav class="mt-2 flex flex-col text-sm">
        <template v-for="g in groups" :key="g.label">
          <p class="mt-3 px-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{{ g.label }}</p>
          <NuxtLink v-for="m in g.items" :key="m.to" :to="m.to"
            class="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-white/10"
            active-class="!bg-white/15 font-semibold">
            <i :class="['pi', m.icon]" />
            {{ m.label }}
          </NuxtLink>
        </template>
      </nav>
    </aside>
    <div class="flex min-w-0 flex-1 flex-col">
      <header class="flex items-center justify-between border-b border-neutral-800 bg-neutral-900 px-6 py-3">
        <h1 class="text-base font-semibold">{{ pageTitle }}</h1>
        <div class="flex items-center gap-3">
          <Button :icon="dark ? 'pi pi-sun' : 'pi pi-moon'" text rounded @click="toggleDark" aria-label="Đổi giao diện" />
          <span class="text-sm text-neutral-400">{{ displayName }}</span>
          <Tag :value="role || 'admin'" severity="info" />
          <Button label="Đăng xuất" icon="pi pi-sign-out" size="small" severity="danger" outlined @click="logout" />
        </div>
      </header>
      <main class="flex-1 p-6">
        <slot />
      </main>
    </div>
    <Toast />
    <ConfirmDialog />
  </div>
</template>

<script setup lang="ts">
const { user, role, logout, dark, toggleDark } = useCmsAuth();
const route = useRoute();

const groups = [
  {
    label: 'Nội dung',
    items: [
      { to: '/phim', label: 'Phim', icon: 'pi-video' },
      { to: '/videos', label: 'Videos', icon: 'pi-play' },
      { to: '/short', label: 'Short', icon: 'pi-bolt' },
      { to: '/tap-tin', label: 'Tập tin', icon: 'pi-folder-open' },
      { to: '/the-loai', label: 'Thể loại', icon: 'pi-tags' },
      { to: '/dien-vien', label: 'Diễn viên', icon: 'pi-user' },
      { to: '/danh-sach-phat', label: 'Danh sách phát', icon: 'pi-list' },
      { to: '/bai-viet', label: 'Bài viết', icon: 'pi-file-edit' },
      { to: '/su-kien', label: 'Sự kiện', icon: 'pi-calendar' },
      { to: '/danh-muc', label: 'Danh mục', icon: 'pi-folder' },
      { to: '/truyen-hinh', label: 'Truyền hình & EPG', icon: 'pi-tv' },
    ],
  },
  {
    label: 'Hiển thị',
    items: [
      { to: '/giao-dien', label: 'Giao diện', icon: 'pi-images' },
    ],
  },
  {
    label: 'Người dùng',
    items: [
      { to: '/nguoi-dung', label: 'Người dùng', icon: 'pi-users' },
      { to: '/thong-bao', label: 'Thông báo', icon: 'pi-bell' },
      { to: '/tu-khoa', label: 'Từ khoá', icon: 'pi-search' },
    ],
  },
  {
    label: 'Thống kê',
    items: [
      { to: '/thong-ke', label: 'Thống kê', icon: 'pi-chart-bar' },
    ],
  },
  {
    label: 'Quản trị',
    items: [
      { to: '/goi-cuoc', label: 'Gói cước', icon: 'pi-credit-card' },
      { to: '/livestream', label: 'Livestream', icon: 'pi-broadcast-tower' },
      { to: '/cai-dat', label: 'Cài đặt', icon: 'pi-cog' },
      { to: '/nhat-ky', label: 'Nhật ký', icon: 'pi-history' },
    ],
  },
];

const titles: Record<string, string> = {
  '/': 'Dashboard',
  '/phim': 'Quản lý Phim',
  '/videos': 'Quản lý Videos',
  '/short': 'Quản lý Short',
  '/tap-tin': 'Thư viện Tập tin',
  '/the-loai': 'Quản lý Thể loại',
  '/dien-vien': 'Quản lý Diễn viên',
  '/danh-sach-phat': 'Quản lý Danh sách phát',
  '/bai-viet': 'Quản lý Bài viết',
  '/su-kien': 'Quản lý Sự kiện',
  '/danh-muc': 'Quản lý Danh mục',
  '/truyen-hinh': 'Truyền hình & EPG',
  '/giao-dien': 'Giao diện (Banner / Rail)',
  '/nguoi-dung': 'Người dùng',
  '/thong-bao': 'Thông báo',
  '/tu-khoa': 'Từ khoá tìm kiếm & Từ cấm',
  '/thong-ke': 'Thống kê',
  '/goi-cuoc': 'Gói cước',
  '/livestream': 'Livestream',
  '/cai-dat': 'Cài đặt hệ thống',
  '/nhat-ky': 'Nhật ký hoạt động',
};
const pageTitle = computed(() => titles[route.path] || 'VTC ANY CMS');
const displayName = computed(() => user.value?.email || user.value?.username || 'Admin');
</script>
