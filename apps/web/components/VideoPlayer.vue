<template>
  <div
    class="relative w-full overflow-hidden rounded-xl bg-black"
    :class="aspect === '9/16' ? 'aspect-[9/16]' : 'aspect-video'"
  >
    <video
      ref="videoEl"
      class="h-full w-full"
      controls
      playsinline
      :poster="poster"
      @canplay="loading = false"
      @waiting="loading = true"
      @playing="loading = false"
    />
    <!-- Chon chat luong thu cong (chi hien khi HLS co nhieu muc) -->
    <div v-if="levels.length > 1" class="absolute right-2 top-2 z-10">
      <button
        type="button"
        class="flex items-center gap-1.5 rounded-lg bg-black/70 px-2.5 py-1.5 text-xs font-semibold text-white backdrop-blur transition hover:bg-black/90"
        @click.stop="menuOpen = !menuOpen"
      >
        <i class="pi pi-cog !text-xs" />
        {{ qualityLabel }}
      </button>
      <div
        v-if="menuOpen"
        class="absolute right-0 top-full mt-1 w-32 overflow-hidden rounded-lg bg-black/90 py-1 shadow-xl backdrop-blur"
      >
        <button
          type="button"
          class="flex w-full items-center justify-between px-3 py-2 text-left text-xs text-white transition hover:bg-white/10"
          :class="{ 'font-bold text-emerald-400': manualLevel === -1 }"
          @click="setQuality(-1)"
        >
          Tự động
          <i v-if="manualLevel === -1" class="pi pi-check !text-xs" />
        </button>
        <button
          v-for="lv in levels"
          :key="lv.index"
          type="button"
          class="flex w-full items-center justify-between px-3 py-2 text-left text-xs text-white transition hover:bg-white/10"
          :class="{ 'font-bold text-emerald-400': manualLevel === lv.index }"
          @click="setQuality(lv.index)"
        >
          {{ lv.height }}p
          <i v-if="manualLevel === lv.index" class="pi pi-check !text-xs" />
        </button>
      </div>
    </div>
    <div v-if="loading" class="absolute inset-0 flex items-center justify-center bg-black/40">
      <i class="pi pi-spin pi-spinner !text-4xl text-white" />
    </div>
  </div>
</template>

<script setup lang="ts">
import Hls from 'hls.js';

// aspect: '16/9' (mac dinh) hoac '9/16' cho short doc.
const props = defineProps<{ src: string; poster?: string; aspect?: string }>();
const emit = defineEmits<{ (e: 'ended'): void }>();

const videoEl = ref<HTMLVideoElement | null>(null);
const loading = ref(true);
let hls: Hls | null = null;

// Chat luong thu cong: levels tu hls.js (chi co khi HLS multibitrate).
// manualLevel = -1 -> Tu dong (ABR); >= 0 -> khoa muc cu the.
const levels = ref<Array<{ index: number; height: number }>>([]);
const manualLevel = ref(-1);
const autoLevel = ref(-1);
const menuOpen = ref(false);
const qualityLabel = computed(() => {
  if (manualLevel.value >= 0) {
    const lv = levels.value.find((l) => l.index === manualLevel.value);
    return lv ? `${lv.height}p` : 'Tự động';
  }
  return 'Tự động';
});

function setQuality(i: number) {
  manualLevel.value = i;
  if (hls) hls.currentLevel = i; // -1 = ABR tu dong
  menuOpen.value = false;
}

function onDocClick() {
  menuOpen.value = false;
}

function currentTime(): number {
  return videoEl.value ? Math.floor(videoEl.value.currentTime) : 0;
}

defineExpose({ currentTime, videoEl });

onMounted(() => {
  const video = videoEl.value;
  if (!video || !props.src) {
    loading = false;
    return;
  }
  video.addEventListener('ended', () => emit('ended'));
  if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = props.src; // Safari: HLS native
  } else if (Hls.isSupported()) {
    hls = new Hls();
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      if (!hls) return;
      levels.value = hls.levels
        .map((l, i) => ({ index: i, height: l.height || 0 }))
        .filter((l) => l.height > 0)
        .sort((a, b) => b.height - a.height);
    });
    hls.on(Hls.Events.LEVEL_SWITCHED, (_evt, data) => {
      autoLevel.value = data.level;
    });
    hls.loadSource(props.src);
    hls.attachMedia(video);
    document.addEventListener('click', onDocClick);
  } else {
    loading = false;
  }
});

onUnmounted(() => {
  document.removeEventListener('click', onDocClick);
  hls?.destroy();
  hls = null;
});
</script>
