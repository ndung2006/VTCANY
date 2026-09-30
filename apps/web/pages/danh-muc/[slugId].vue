<template>
  <div class="p-5">
    <div v-if="pending" class="flex flex-col gap-3">
      <Skeleton width="16rem" height="2rem" />
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        <Skeleton v-for="i in 10" :key="i" width="100%" height="10rem" border-radius="0.5rem" />
      </div>
    </div>

    <template v-else-if="rail">
      <h1 class="text-xl font-bold">{{ rail.title }}</h1>
      <div class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        <NuxtLink v-for="item in rail.items" :key="item.public_id" :to="contentUrl(item)" class="block">
          <div
            class="w-full overflow-hidden rounded-lg bg-neutral-800"
            :class="rail.card_aspect === '3:4' ? 'aspect-[3/4]' : 'aspect-[3/2]'"
          >
            <img :src="item.thumbnail" :alt="item.title" class="h-full w-full object-cover" loading="lazy" />
          </div>
          <h3 class="mt-2 line-clamp-2 text-sm text-neutral-200">{{ item.title }}</h3>
        </NuxtLink>
      </div>
    </template>

    <p v-else class="mt-4 text-neutral-400">Không tải được danh mục.</p>
  </div>
</template>

<script setup lang="ts">
import type { RailBlock } from '@/components/RailCarousel.vue';
import { contentUrl, parseSlugId } from '@/utils/url';

const route = useRoute();
const config = useRuntimeConfig();
const slugId = String(route.params.slugId);

try {
  parseSlugId(slugId);
} catch {
  throw createError({ statusCode: 404, statusMessage: 'Danh mục không tồn tại' });
}

const { data, pending, error } = await useFetch('/layout/home', {
  baseURL: config.public.apiBase as string,
  query: { platform: 'WEB' },
});

interface HomeResponse {
  layout_blocks: Array<{
    order: number;
    type: string;
    title?: string;
    target_url?: string;
    card_aspect?: string;
    items: RailBlock['items'];
  }>;
}

const rail = computed(() => {
  const blocks = (data.value as unknown as HomeResponse | null)?.layout_blocks ?? [];
  const found = blocks.find((b) => b.type === 'HORIZONTAL_LIST' && b.target_url === `/danh-muc/${slugId}`);
  if (!found) return null;
  return found as unknown as RailBlock;
});

watch(
  rail,
  (r) => {
    // Chỉ 404 khi API trả về OK nhưng không có rail này; lỗi mạng thì hiện thông báo.
    if (!pending.value && !error.value && !r) {
      throw createError({ statusCode: 404, statusMessage: 'Danh mục không tồn tại' });
    }
  },
  { immediate: true },
);

useHead({ title: computed(() => (rail.value?.title ? `${rail.value.title} - VTC ANY` : 'Danh mục - VTC ANY')) });
</script>
