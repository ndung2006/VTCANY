<template>
  <div class="p-5">
    <h1 class="text-xl font-bold">Short</h1>

    <div v-if="pending" class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      <Skeleton v-for="i in 10" :key="i" width="100%" height="16rem" border-radius="0.5rem" />
    </div>

    <div v-else-if="items.length" class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      <NuxtLink
        v-for="s in items"
        :key="s.public_id"
        :to="`/short/${s.slug}-${s.public_id}`"
        class="block"
      >
        <div class="relative aspect-[9/16] w-full overflow-hidden rounded-lg bg-neutral-800">
          <img v-if="s.thumbnail" :src="s.thumbnail" :alt="s.title" class="h-full w-full object-cover" loading="lazy" />
          <span
            v-if="s.duration"
            class="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] text-white"
          >{{ s.duration }}</span>
        </div>
        <h3 class="mt-2 line-clamp-2 text-sm text-neutral-200">{{ s.title }}</h3>
      </NuxtLink>
    </div>

    <p v-else class="mt-4 text-neutral-400">Chưa có short nào được xuất bản.</p>
  </div>
</template>

<script setup lang="ts">
// Danh sach Short lay tu catalog CMS (chi noi dung da xuat ban qua /catalog/shorts),
// khong con lay tu layout/home cua he cu.
useHead({ title: 'Short - VTC ANY' });

interface PublicItem {
  id: string;
  public_id: string;
  slug: string;
  title: string;
  thumbnail?: string;
  duration?: string | null;
}

const config = useRuntimeConfig();
const { data, pending } = await useFetch('/catalog/shorts', {
  baseURL: config.public.apiBase as string,
  query: { limit: 60 },
});
const items = computed<PublicItem[]>(() => ((data.value as { data?: PublicItem[] } | null)?.data ?? []));
</script>
