<script lang="ts" setup>
import { computed, ref, onMounted, watch } from 'vue';
import { drawFrame } from '@/utils/shapes/hand-drawn-frame';

const props = defineProps<{
  lineWidth?: number;
  resolution?: number;
  wiggle?: number;
  color?: string;
}>();

const observer = ref<ResizeObserver | null>(null);
const wrapperEl = ref<HTMLElement | null>(null);

const width = ref(1);
const height = ref(1);
const dpr = ref(2);

onMounted(() => {
  if (typeof window === 'undefined') return;

  dpr.value = window.devicePixelRatio;

  if ('ResizeObserver' in window) {
    observer.value = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry.borderBoxSize.length) {
        width.value = entry.borderBoxSize[0].inlineSize;
        height.value = entry.borderBoxSize[0].blockSize;
      }
    });

    if (wrapperEl.value) {
      observer.value.observe(wrapperEl.value);
    }
  }

  return () => {
    if (observer.value) {
      observer.value.disconnect();
    }
  };
});

watch(
  () => wrapperEl.value,
  (el, oldEl) => {
    if (observer.value) {
      if (oldEl) {
        observer.value.unobserve(oldEl);
      }

      if (el) {
        observer.value.observe(el);
      }
    } else if (el) {
      width.value = el.clientWidth;
      height.value = el.clientHeight;
    }
  }
);

const lineWidth = computed(() => props.lineWidth ?? 4);
const resolution = computed(() => props.resolution ?? 10);
const wiggle = computed(() => props.wiggle ?? 1);
const color = computed(() => props.color ?? 'black');

const frameCanvas = computed(() => {
  return drawFrame({
    width: width.value * dpr.value,
    height: height.value * dpr.value,
    lineWidth: lineWidth.value * dpr.value,
    resolution: resolution.value * dpr.value,
    wiggle: wiggle.value * dpr.value,
    color: color.value,
  });
});
const frame = computed(() => {
  return frameCanvas.value.toDataURL();
});
</script>

<template>
  <div
    ref="wrapperEl"
    :style="{
      border: `${(lineWidth / 2 + wiggle) * dpr}px solid black`,
      borderImage: `url(${frame}) ${(lineWidth + wiggle * 2) * dpr}`,
      borderImageOutset: `${(lineWidth / 2) * dpr}px`,
    }"
  >
    <slot />
  </div>
</template>
