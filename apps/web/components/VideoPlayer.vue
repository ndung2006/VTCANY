<template>
  <div class="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
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
    <div v-if="loading" class="absolute inset-0 flex items-center justify-center bg-black/40">
      <i class="pi pi-spin pi-spinner !text-4xl text-white" />
    </div>
  </div>
</template>

<script setup lang="ts">
import Hls from 'hls.js';

const props = defineProps<{ src: string; poster?: string }>();
const emit = defineEmits<{ (e: 'ended'): void }>();

const videoEl = ref<HTMLVideoElement | null>(null);
const loading = ref(true);
let hls: Hls | null = null;

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
    hls.loadSource(props.src);
    hls.attachMedia(video);
  } else {
    loading = false;
  }
});

onUnmounted(() => {
  hls?.destroy();
  hls = null;
});
</script>
