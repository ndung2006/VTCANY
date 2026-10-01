<template>
  <div class="p-5">
    <h1 class="text-xl font-bold">Video</h1>

    <div v-if="pending" class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      <Skeleton v-for="i in 8" :key="i" width="100%" height="10rem" border-radius="0.5rem" />
    </div>

    <div v-else-if="items.length" class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      <NuxtLink
        v-for="v in items"
        :key="v.public_id"
        :to="`/video/${v.slug}-${v.public_id}`"
        class="block"
      >
        <div class="relative aspect-video w-full overflow-hidden rounded-lg bg-neutral-800">
          <img v-if="v.thumbnail" :src="v.thumbnail" :alt="v.title" class="h-full w-full object-cover" loading="lazy" />
          <span
            v-if="v.duration"
            class="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] text-white"
          >{{ v.duration }}</span>
        </div>
        <h3 class="mt-2 line-clamp-2 text-sm text-neutral-200">{{ v.title }}</h3>
      </NuxtLink>
    </div>

    <p v-else class="mt-4 text-neutral-400">Chưa có video nào được xuất bản.</p>
  </div>
</template>

<script setup lang="ts">
// Danh sach Video lay tu catalog CMS (chi noi dung da xuat ban qua /catalog/videos).
useHead({ title: 'Video - VTC ANY' });

interface PublicItem {
  id: string;
  public_id: string;
  slug: string;
  title: string;
  thumbnail?: string;
  duration?: string | null;
}

const config = useRuntimeConfig();
const { data, pending } = await useFetch('/catalog/videos', {
  baseURL: config.public.apiBase as string,
  query: { limit: 60 },
});
const items = computed<PublicItem[]>(() => ((data.value as { data?: PublicItem[] } | null)?.data ?? []));
</script>
