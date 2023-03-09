<script lang="ts" setup>
import { ref, shallowRef } from 'vue';
import { useRouter, loadRouteLocation } from 'vue-router';
import { useIntersectionObserver } from '@vueuse/core';
import type { Component } from 'vue';

import LoadingIcon from '@/components/LoadingIcon.vue';
import DrawnFrame from '@/components/DrawnFrame.vue';
import SketchLinks from '@/components/SketchLinks.vue';
import { isSketch } from '@/utils/sketch-parsing';
import type { Sketch } from '@/utils/sketch-parsing';
import type LoadQueue from '@/utils/load-queue';

const props = defineProps<{
  sketch: Sketch;
  loadQueue: LoadQueue;
}>();

const router = useRouter();

const state = ref<'waiting' | 'loading' | 'loaded'>('waiting');

const animating = ref<'true' | 'false'>('false');
const sketchPreview = shallowRef<Component | null>(null);

const loadedCallback = ref<(() => void) | null>(null);

async function getSketchComponent(sketch: Sketch) {
  const route = router.resolve(sketch.path);
  const loadedRoute = await loadRouteLocation(route);

  const component = loadedRoute?.matched[0]?.components?.default;
  if (!component)
    throw new Error(`No component found for ${sketch.name || sketch.path}`);

  return component;
}

async function loadPreview() {
  if (state.value !== 'waiting') return;

  const sketch = props.sketch;
  if (sketch.tags.includes('WebXR') || sketch.tags.includes('No preview'))
    return;

  const sketchIsGlsl = sketch.filePath.endsWith('.glsl');

  const assetsToPreload: string[] = [];
  try {
    const text = sketch.moduleText;

    // Three.js loaders
    for (const match of text.matchAll(/\.load(?:Async)?\(\s*'([^']+)'/g)) {
      assetsToPreload.push(match[1]);
    }

    // CSS font loading API
    for (const match of text.matchAll(/FontFace\([^()]+url\(([^)]+)\)'/g)) {
      assetsToPreload.push(match[1]);
    }
  } catch (e) {
    console.error('Error caught detecting loaders', e);
  }

  let baseScore = 0;
  if (sketchIsGlsl) baseScore -= 50;
  if (sketch.tags.includes('Three.js')) baseScore += 20;
  baseScore += 10 * assetsToPreload.length;
  if (sketch.tags.includes('Slow')) baseScore += 1000;

  props.loadQueue.request({
    key: sketch,
    priority(other) {
      if (!isSketch(other)) return 0;

      // Lowest score loads first
      let score = baseScore;

      const otherIsGlsl = other.filePath.endsWith('.glsl');
      if (sketchIsGlsl && otherIsGlsl) {
        const thisLength = sketch.moduleText.length;
        const otherLength = other.moduleText.length;

        // Prefer the shorter one
        if (thisLength < otherLength) score -= 1;
        if (thisLength > otherLength) score += 1;
      }

      return score;
    },
    preload: () => {
      return Promise.all([
        getSketchComponent(sketch),
        ...assetsToPreload.map((url) => fetch(url)),
      ]);
    },
    work: async () => {
      sketchPreview.value = await getSketchComponent(sketch);

      await new Promise<void>((resolve) => {
        loadedCallback.value = resolve;
      });
    },
  });

  state.value = 'loading';
}

function hidePreview() {
  state.value = 'waiting';
  sketchPreview.value = null;
}

function setAnimating(animate: boolean) {
  animating.value = animate ? 'true' : 'false';
  if (animate) loadPreview();
}

const wrapperEl = ref<HTMLElement | null>(null);
useIntersectionObserver(wrapperEl, ([entry]) => {
  if (entry.isIntersecting) {
    loadPreview();
  } else {
    hidePreview();
  }
});
</script>

<template>
  <div ref="wrapperEl">
    <RouterLink :to="sketch.path">
      <DrawnFrame
        class="border-zinc-800"
        :line-width="3"
        no-border
        @mouseenter="setAnimating(true)"
        @mouseleave="setAnimating(false)"
      >
        <div class="w-full aspect-video bg-zinc-300 relative overflow-hidden">
          <Transition name="fade" mode="in-out">
            <component
              v-if="sketchPreview"
              :is="sketchPreview"
              class="bg-white absolute inset-0"
              preview
              :animating-override="animating"
              @frame.once="loadedCallback?.()"
            />
            <div
              v-else
              class="absolute inset-0 flex items-center justify-center"
            >
              <span
                v-if="sketch.tags.includes('WebXR')"
                class="text-xl text-center"
              >
                Click to preview<br />WebXR sketch
              </span>
              <span
                v-else-if="sketch.tags.includes('No preview')"
                class="text-xl text-center"
              >
                No preview available
              </span>
              <LoadingIcon v-else class="text-2xl" />
            </div>
          </Transition>
        </div>
      </DrawnFrame>
    </RouterLink>

    <div class="mt-3 md:mt-4 flex justify-between items-center">
      <RouterLink :to="sketch.path">
        <h2>
          <span v-if="sketch.favourite">
            <span aria-hidden="true">⭐️</span>
            <span class="sr-only">Favourite:</span>
          </span>
          {{ sketch.name || sketch.path }}
        </h2>
      </RouterLink>

      <div v-if="sketch.date" class="text-xs text-zinc-500">
        {{ sketch.date.format('Do MMMM YYYY') }}
      </div>
    </div>

    <div class="flex justify-between gap-4 mt-2">
      <div v-if="sketch.tags.length" class="flex flex-wrap gap-2">
        <div
          v-for="tag in sketch.tags"
          :key="tag"
          class="inline-block text-xs px-1.5 py-1 bg-zinc-600 text-zinc-50 rounded-sm"
        >
          {{ tag }}
        </div>
      </div>
      <SketchLinks :sketch="sketch" size="small" class="justify-end grow" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
