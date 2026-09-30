<template>
  <div class="p-5">
    <h1 class="text-xl font-bold">{{ title }}</h1>

    <div v-if="pending" class="mt-4 flex flex-col gap-4">
      <Skeleton width="100%" height="22rem" border-radius="0.75rem" />
      <Skeleton width="100%" height="10rem" border-radius="0.75rem" />
      <Skeleton width="100%" height="10rem" border-radius="0.75rem" />
    </div>

    <template v-else-if="heroItems.length || railBlocks.length">
      <HeroCarousel :items="heroItems" />
      <RailCarousel v-for="rail in railBlocks" :key="rail.order" :block="rail" />
    </template>

    <p v-else class="mt-4 text-neutral-400">Chưa có nội dung cho mục này.</p>
  </div>
</template>

<script setup lang="ts">
import type { HeroItem } from '@/components/HeroCarousel.vue';
import type { RailBlock, RailItem } from '@/components/RailCarousel.vue';

// Trang tab kiểu vtcplay.vn (/phim, /short, /giai-tri):
// hero banner + các rail lọc theo loại nội dung.
const props = defineProps<{
  title: string;
  pageTitle: string;
  types: string[];
}>();

useHead({ title: props.pageTitle });

const config = useRuntimeConfig();

const { data, pending } = await useFetch('/layout/home', {
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
    items: RailItem[];
  }>;
}

const blocks = computed(() => ((data.value as unknown as HomeResponse | null)?.layout_blocks ?? []));

const heroItems = computed(() => {
  const h = blocks.value.find((b) => b.type === 'HERO_CAROUSEL');
  return ((h?.items ?? []) as unknown) as HeroItem[];
});

const railBlocks = computed(() =>
  blocks.value
    .filter((b) => b.type === 'HORIZONTAL_LIST')
    .map((b) => ({ ...b, items: b.items.filter((i) => props.types.includes(i.type ?? '')) }))
    .filter((b) => b.items.length)
    .map((b) => b as unknown as RailBlock),
);
</script>
