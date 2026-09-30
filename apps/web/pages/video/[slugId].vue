<template>
  <div class="p-5">
    <h1 class="text-xl font-bold">Xem video</h1>
    <p class="mt-2 font-mono text-sm text-neutral-400">{{ route.params.slugId }}</p>
    <p class="mt-2 text-sm text-neutral-400">Trang xem video — làm ở Bước 4.</p>
  </div>
</template>

<script setup lang="ts">
const route = useRoute();
</script>
