<template>
  <div class="p-5">
    <div v-if="pending" class="flex flex-col gap-4">
      <Skeleton width="100%" height="22rem" border-radius="0.75rem" />
      <Skeleton width="100%" height="10rem" border-radius="0.75rem" />
      <Skeleton width="100%" height="10rem" border-radius="0.75rem" />
    </div>

    <template v-else-if="blocks.length">
      <HeroCarousel :items="heroItems" />
      <RailCarousel v-for="rail in railBlocks" :key="rail.order" :block="rail" />
    </template>

    <p v-else class="text-neutral-400">Không tải được trang chủ.</p>
  </div>
</template>

<script setup lang="ts">
import type { HeroItem, } from '@/components/HeroCarousel.vue';
import type { RailBlock } from '@/components/RailCarousel.vue';

const config = useRuntimeConfig();

const { data, pending } = await useFetch('/layout/home', {
  baseURL: config.public.apiBase as string,
  query: { platform: 'WEB' },
});

interface HomeResponse {
  platform: string;
  layout_blocks: Array<{
    order: number;
    type: string;
    title?: string;
    target_url?: string;
    card_aspect?: string;
    items: Array<Record<string, string | boolean>>;
  }>;
}

const blocks = computed(() => ((data.value as unknown as HomeResponse | null)?.layout_blocks ?? []));
const heroItems = computed(() => {
  const h = blocks.value.find((b) => b.type === 'HERO_CAROUSEL');
  return ((h?.items ?? []) as unknown) as HeroItem[];
});
const railBlocks = computed(() => {
  const r = blocks.value.filter((b) => b.type === 'HORIZONTAL_LIST');
  return (r as unknown) as RailBlock[];
});
</script>
