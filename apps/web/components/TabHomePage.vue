<template>
  <div class="p-5">
    <h1 class="text-xl font-bold">{{ title }}</h1>

    <div v-if="pending" class="mt-4 flex flex-col gap-4">
      <Skeleton width="100%" height="22rem" border-radius="0.75rem" />
      <Skeleton width="100%" height="10rem" border-radius="0.75rem" />
      <Skeleton width="100%" height="10rem" border-radius="0.75rem" />
    </div>

    <template v-else-if="heroItems.length || catRails?.length">
      <HeroCarousel :items="heroItems" />
      <RailCarousel v-for="rail in catRails" :key="rail.order" :block="rail" />
    </template>

    <p v-else class="mt-4 text-neutral-400">Chưa có nội dung cho mục này.</p>
  </div>
</template>

<script setup lang="ts">
import type { HeroItem } from '@/components/HeroCarousel.vue';
import type { RailBlock, RailItem } from '@/components/RailCarousel.vue';

// Trang tab kieu vtcplay.vn (/phim, /video, /short):
// hero banner + rail RIENG THEO TUNG DANH MUC cua loai noi dung do
// (vd: /short -> rail "Check in Viet Nam", "Phim ngan"...).
const props = defineProps<{
  title: string;
  pageTitle: string;
  types: string[];
}>();

useHead({ title: props.pageTitle });

const config = useRuntimeConfig();

const KIND = {
  phim: { catType: 'phim', endpoint: '/catalog/movies', cardAspect: '3/4', itemType: 'phim' },
  video: { catType: 'video', endpoint: '/catalog/videos', cardAspect: '3/2', itemType: 'video' },
  short: { catType: 'short', endpoint: '/catalog/shorts', cardAspect: '9/16', itemType: 'short' },
} as const;
type KindKey = keyof typeof KIND;
const kind = KIND[(props.types[0] as KindKey) ?? 'phim'] ?? KIND.phim;

interface PublicItem {
  id: string;
  public_id: string;
  slug: string;
  title: string;
  thumbnail?: string;
  poster?: string;
  planId?: string | null;
}

// Hero giu tu layout/home (do CMS cau hinh).
const { data: layoutData } = await useFetch('/layout/home', {
  baseURL: config.public.apiBase as string,
  query: { platform: 'WEB' },
});
const blocks = computed(() => ((layoutData.value as { layout_blocks?: any[] } | null)?.layout_blocks ?? []));
const heroItems = computed(() => {
  const h = blocks.value.find((b) => b.type === 'HERO_CAROUSEL');
  return ((h?.items ?? []) as unknown) as HeroItem[];
});

// Rail theo tung danh muc: lay danh muc cua loai -> moi danh muc lay items.
const { data: catRails, pending } = await useAsyncData(`tab-rails-${kind.catType}`, async () => {
  const catRes: any = await $fetch('/catalog/categories', {
    baseURL: config.public.apiBase as string,
    query: { type: kind.catType },
  });
  const cats: Array<{ id: string; name: string }> = catRes?.data ?? [];
  const rails: RailBlock[] = [];
  for (const [i, c] of cats.entries()) {
    const itemRes: any = await $fetch(kind.endpoint, {
      baseURL: config.public.apiBase as string,
      query: { categoryId: c.id, limit: 24 },
    });
    const items: RailItem[] = (itemRes?.data ?? []).map((it: PublicItem) => ({
      id: it.id,
      public_id: it.public_id,
      slug: it.slug,
      title: it.title,
      thumbnail: it.poster || it.thumbnail || '',
      aspect: kind.cardAspect,
      is_premium: !!it.planId,
      type: kind.itemType,
    }));
    if (items.length) {
      rails.push({ order: i, type: 'HORIZONTAL_LIST', title: c.name, card_aspect: kind.cardAspect, items });
    }
  }
  return rails;
});
</script>
