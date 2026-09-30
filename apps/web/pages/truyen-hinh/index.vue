<template>
  <div class="p-5">
    <h1 class="text-xl font-bold">Truyền hình</h1>

    <Carousel :value="dates" :num-visible="5" :num-scroll="5" class="mt-4">
      <template #item="{ data }">
        <button
          class="mx-1 w-full rounded-lg px-2 py-2 text-sm"
          :class="data.iso === activeDate ? 'bg-sky-500 font-semibold text-white' : 'bg-neutral-800 hover:bg-neutral-700'"
          @click="activeDate = data.iso"
        >
          {{ data.label }}
        </button>
      </template>
    </Carousel>

    <div v-if="pending" class="mt-4 flex flex-col gap-2">
      <Skeleton width="100%" height="3rem" />
      <Skeleton width="100%" height="3rem" />
    </div>

    <Accordion v-else class="mt-4" :value="openGroup">
      <AccordionPanel v-for="g in groups" :key="g.name" :value="g.name">
        <AccordionHeader>{{ g.name }} ({{ g.channels.length }})</AccordionHeader>
        <AccordionContent>
          <p v-if="!g.channels.length" class="text-sm text-neutral-400">Đang cập nhật kênh.</p>
          <div class="flex flex-col gap-1">
            <button
              v-for="c in g.channels"
              :key="c.public_id"
              class="flex items-center gap-3 rounded-lg p-2 text-left hover:bg-neutral-800"
              @click="pick(c)"
            >
              <span class="flex h-10 w-10 items-center justify-center rounded bg-neutral-700 text-sm font-bold">
                {{ c.name.slice(0, 1) }}
              </span>
              <span class="text-sm font-semibold">{{ c.name }}</span>
              <span v-if="c.audio_only" class="rounded bg-neutral-700 px-2 py-0.5 text-xs">Radio</span>
              <span v-if="current?.public_id === c.public_id" class="ml-auto flex items-center gap-1 text-xs text-red-400">
                <span class="h-2 w-2 rounded-full bg-red-500" /> Đang xem
              </span>
            </button>
          </div>
        </AccordionContent>
      </AccordionPanel>
    </Accordion>

    <div v-if="current" class="mt-6">
      <h2 class="mb-2 text-lg font-bold">{{ current.name }}</h2>
      <VideoPlayer v-if="epg?.channel.hls_url" :key="current.public_id" :src="epg.channel.hls_url" />
      <p v-else class="text-sm text-neutral-400">Kênh chưa có luồng phát.</p>
      <h3 class="mb-2 mt-4 font-semibold">Lịch phát sóng</h3>
      <ul class="flex flex-col gap-1">
        <li v-for="it in epg?.timeline ?? []" :key="it.time + it.title" class="flex items-center gap-3 text-sm">
          <span class="w-12 shrink-0 text-neutral-400">{{ it.time }}</span>
          <span class="min-w-0 flex-1 truncate">{{ it.title }}</span>
          <span
            v-if="it.status === 'LIVE'"
            class="flex items-center gap-1 rounded bg-red-600 px-2 py-0.5 text-xs font-semibold"
          >
            <span class="h-1.5 w-1.5 rounded-full bg-white" /> LIVE
          </span>
          <span v-else class="text-xs text-neutral-400">{{ it.status }}</span>
        </li>
      </ul>
      <p v-if="!(epg?.timeline ?? []).length" class="text-sm text-neutral-400">Chưa có lịch ngày này.</p>
    </div>

    <Dialog v-model:visible="showLogin" modal header="Thông báo" :style="{ width: '22rem' }">
      <p class="text-sm">Vui lòng đăng nhập để xem nội dung!</p>
      <template #footer>
        <Button label="Hủy" severity="secondary" @click="showLogin = false" />
        <Button label="Đăng nhập" @click="navigateTo('/dang-nhap')" />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
const config = useRuntimeConfig();
const { loggedIn, token } = useAuth();

interface Channel {
  public_id: string;
  name: string;
  logo: string | null;
  audio_only: boolean;
}

const { data: groupsData, pending } = await useFetch('/channels', {
  baseURL: config.public.apiBase as string,
});
const groups = computed(() => ((groupsData.value as unknown as { groups: Array<{ name: string; channels: Channel[] }> } | null)?.groups ?? []));

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const todayIso = isoOf(new Date());
const dates = computed(() => {
  const out: Array<{ iso: string; label: string }> = [];
  for (let delta = -3; delta <= 1; delta++) {
    const d = new Date();
    d.setDate(d.getDate() + delta);
    const iso = isoOf(d);
    out.push({ iso, label: iso === todayIso ? 'Hôm nay' : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}` });
  }
  return out;
});
const activeDate = ref(todayIso);

const current = ref<Channel | null>(null);
const epg = ref<{ channel: { hls_url: string | null }; timeline: Array<{ time: string; title: string; status: string }> } | null>(null);
const showLogin = ref(false);
const openGroup = ref<string | undefined>(undefined);

async function pick(c: Channel) {
  if (!loggedIn.value) {
    showLogin.value = true;
    return;
  }
  current.value = c;
  epg.value = null;
  epg.value = await $fetch(`/channels/${c.public_id}/epg`, {
    baseURL: config.public.apiBase as string,
    query: { date: activeDate.value },
    headers: { Authorization: `Bearer ${token.value}` },
  });
}

watch(activeDate, () => {
  if (current.value) pick(current.value);
});
</script>
