<template>
  <div class="mx-auto max-w-md p-5">
    <h1 class="text-xl font-bold">Đăng nhập</h1>
    <p class="mt-2 text-sm text-neutral-400">
      Web dùng đăng nhập OAuth (Google/Facebook) như VTC Play. Dán access token
      đã lấy từ API để tiếp tục xem Truyền hình và Yêu thích.
    </p>
    <div class="mt-4 flex flex-col gap-2">
      <InputText v-model="paste" placeholder="Dán access token (Bearer)" class="w-full" />
      <Button label="Đăng nhập bằng token" @click="doLogin" :disabled="!paste.trim()" />
      <Button label="Về trang chủ" severity="secondary" @click="navigateTo('/')" />
    </div>
    <p v-if="error" class="mt-2 text-sm text-red-400">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
const config = useRuntimeConfig();
const { login } = useAuth();
const paste = ref('');
const error = ref('');

async function doLogin() {
  error.value = '';
  const t = paste.value.trim();
  try {
    await $fetch('/auth/me', {
      baseURL: config.public.apiBase as string,
      headers: { Authorization: `Bearer ${t}` },
    });
    login(t);
    navigateTo('/truyen-hinh');
  } catch {
    error.value = 'Token không hợp lệ.';
  }
}
</script>
