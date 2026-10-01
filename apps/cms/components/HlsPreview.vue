<template>
  <div class="relative h-full w-full bg-black">
    <video ref="videoEl" class="h-full w-full" controls playsinline :poster="poster" />
  </div>
</template>

<script setup lang="ts">
import Hls from 'hls.js';

// Player xem truoc HLS trong CMS (dung chung Short/Video/Tap phim).
const props = defineProps<{ src: string; poster?: string }>();
const videoEl = ref<HTMLVideoElement | null>(null);
let hls: Hls | null = null;

function attach() {
  const video = videoEl.value;
  if (!video || !props.src) return;
  detach();
  if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = props.src; // Safari: HLS native
  } else if (Hls.isSupported()) {
    hls = new Hls();
    hls.loadSource(props.src);
    hls.attachMedia(video);
  }
}

function detach() {
  hls?.destroy();
  hls = null;
}

onMounted(attach);
watch(() => props.src, attach);
onUnmounted(detach);
</script>
