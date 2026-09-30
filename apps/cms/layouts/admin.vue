<template>
  <div class="flex min-h-screen">
    <aside class="w-60 shrink-0 bg-admin p-4 text-neutral-200">
      <NuxtLink to="/" class="flex items-center gap-2 px-2 py-3">
        <img src="/logo.svg" alt="VTC ANY" width="120" height="50" />
      </NuxtLink>
      <nav class="mt-4 flex flex-col gap-1 text-sm">
        <NuxtLink v-for="m in menu" :key="m.to" :to="m.to"
          class="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-white/10"
          active-class="!bg-white/15 font-semibold">
          <i :class="['pi', m.icon]" />
          {{ m.label }}
        </NuxtLink>
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

const menu = [
  { to: '/', label: 'Dashboard', icon: 'pi-th-large' },
  { to: '/videos', label: 'Videos', icon: 'pi-play' },
  { to: '/danh-muc', label: 'Danh mục', icon: 'pi-folder' },
  { to: '/truyen-hinh', label: 'Truyền hình & EPG', icon: 'pi-tv' },
  { to: '/giao-dien', label: 'Giao diện (Banner/Rail)', icon: 'pi-images' },
  { to: '/nguoi-dung', label: 'Người dùng', icon: 'pi-users' },
  { to: '/nhat-ky', label: 'Nhật ký', icon: 'pi-history' },
];

const titles: Record<string, string> = {
  '/': 'Dashboard',
  '/videos': 'Quản lý Videos',
  '/danh-muc': 'Quản lý Danh mục',
  '/truyen-hinh': 'Truyền hình & EPG',
  '/giao-dien': 'Giao diện (Banner / Rail)',
  '/nguoi-dung': 'Người dùng',
  '/nhat-ky': 'Nhật ký hoạt động',
};
const pageTitle = computed(() => titles[route.path] || 'VTC ANY CMS');
const displayName = computed(() => user.value?.email || user.value?.username || 'Admin');
</script>
