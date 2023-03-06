<script lang="ts" setup>
import { computed, ref, onMounted, watch } from 'vue';
import { drawFrame } from '@/utils/shapes/hand-drawn-frame';

const props = defineProps<{
  lineWidth?: number;
  resolution?: number;
  wiggle?: number;
  color?: string;
  noBorder?: boolean;
  eagerLoad?: boolean;
}>();

const resizeObserver = ref<ResizeObserver | null>(null);
const intersectionObserver = ref<IntersectionObserver | null>(null);
const wrapperEl = ref<HTMLElement | null>(null);

const width = ref(1);
const height = ref(1);
const dpr = ref(2);

const hasIntersected = ref(props.eagerLoad);

onMounted(() => {
  if (typeof window === 'undefined') return;

  dpr.value = window.devicePixelRatio;

  if ('ResizeObserver' in window) {
    resizeObserver.value = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry.borderBoxSize.length) {
        width.value = entry.borderBoxSize[0].inlineSize;
        height.value = entry.borderBoxSize[0].blockSize;
      }
    });

    if (wrapperEl.value) {
      resizeObserver.value.observe(wrapperEl.value);
    }
  }

  if ('IntersectionObserver' in window) {
    intersectionObserver.value = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        hasIntersected.value = true;
      }
    });

    if (wrapperEl.value) {
      intersectionObserver.value.observe(wrapperEl.value);
    }
  }

  return () => {
    if (resizeObserver.value) resizeObserver.value.disconnect();
    if (intersectionObserver.value) intersectionObserver.value.disconnect();
  };
});

watch(
  () => wrapperEl.value,
  (el, oldEl) => {
    if (resizeObserver.value) {
      if (oldEl) resizeObserver.value.unobserve(oldEl);
      if (el) resizeObserver.value.observe(el);
    } else if (el) {
      width.value = el.clientWidth;
      height.value = el.clientHeight;
    }

    if (intersectionObserver.value) {
      if (oldEl) intersectionObserver.value.unobserve(oldEl);
      if (el) intersectionObserver.value.observe(el);
    }
  }
);

const lineWidth = computed(() =>
  props.lineWidth && props.lineWidth > 0 ? props.lineWidth : 4
);
const resolution = computed(() =>
  props.resolution && props.resolution > 0 ? props.resolution : 10
);
const wiggle = computed(() =>
  props.wiggle && props.wiggle >= 0 ? props.wiggle : 1
);
const frameCanvas = computed(() => {
  let color = props.color;
  if (!color) {
    if (wrapperEl.value) {
      color = getComputedStyle(wrapperEl.value).borderColor;
    } else {
      color = 'black';
    }
  }

  return drawFrame({
    width: width.value * dpr.value,
    height: height.value * dpr.value,
    lineWidth: lineWidth.value * dpr.value,
    resolution: resolution.value * dpr.value,
    wiggle: wiggle.value * dpr.value,
    color,
  });
});
const frame = computed(() => frameCanvas.value.toDataURL());
</script>

<template>
  <div
    ref="wrapperEl"
    :style="{
      borderWidth: hasIntersected
        ? `${(lineWidth / 2 + wiggle) * dpr}px`
        : `${lineWidth}px`,
      borderStyle: 'solid',
      borderImage: hasIntersected
        ? `url(${frame}) ${(lineWidth + wiggle * 2) * dpr}`
        : undefined,
      borderImageOutset: `${(lineWidth / 2 + wiggle / 2 - 1) * dpr}px`,
    }"
  >
    <div
      v-if="noBorder"
      :style="{
        position: 'relative',
        zIndex: -1,
        margin: hasIntersected
          ? `${-(lineWidth / 2 + wiggle) * dpr}px`
          : undefined,
      }"
    >
      <slot />
    </div>
    <slot v-else />
  </div>
</template>
