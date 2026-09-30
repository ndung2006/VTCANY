<template>
  <div class="p-5">
    <h1 class="text-xl font-bold">Tìm kiếm: {{ q }}</h1>
    <p class="mt-2 text-sm text-neutral-400">Kết quả tìm kiếm nhóm theo loại — làm ở Bước 5.</p>
  </div>
</template>

<script setup lang="ts">
const route = useRoute();
const q = computed(() => String(route.query.s ?? ''));
</script>
