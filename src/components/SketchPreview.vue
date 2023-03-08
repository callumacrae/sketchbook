<script lang="ts" setup>
import { ref, shallowRef } from 'vue';
import { useRouter } from 'vue-router';
import { useIntersectionObserver } from '@vueuse/core';
import type { Component } from 'vue';

import LoadingIcon from '@/components/LoadingIcon.vue';
import DrawnFrame from '@/components/DrawnFrame.vue';
import IconLink from '@/components/IconLink.vue';
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

async function loadPreview() {
  if (state.value !== 'waiting') return;

  const sketch = props.sketch;
  const sketchIsGlsl = sketch.filePath.endsWith('.glsl');

  let baseScore = 0;
  if (sketchIsGlsl) baseScore -= 50;
  if (sketch.tags.includes('Three.js')) baseScore += 20;
  baseScore += 10 * (sketch.moduleText.match(/\.load/g) || []).length;
  if (sketch.tags.includes('Slow')) baseScore += 1000;

  props.loadQueue.request({
    key: sketch,
    priority(o) {
      // TODO: make not gross?
      const other = o as Sketch;

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
    work: async () => {
      const route = router.resolve(sketch.path);
      const component = route?.matched[0]?.components?.default;
      if (!component)
        throw new Error(`No component found for ${sketch.name || sketch.path}`);

      // I don't really understand what's going on with the types here, but I
      // don't want to work on this anymore lol
      function assertLazyComponent(
        c: typeof component
      ): asserts c is () => Promise<{ default: Component }> {
        if (typeof c !== 'function') throw new Error('not a lazy component');
      }
      assertLazyComponent(component);

      const resolvedComponent = await component();
      sketchPreview.value = resolvedComponent.default;

      await new Promise<void>((resolve) => {
        loadedCallback.value = resolve;
      });
    },
  });

  state.value = 'loading';
}

function setAnimating(animate: boolean) {
  animating.value = animate ? 'true' : 'false';
  if (animate) loadPreview();
}

const wrapperEl = ref<HTMLElement | null>(null);
useIntersectionObserver(wrapperEl, ([entry]) => {
  if (entry.isIntersecting) loadPreview();
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
              class="absolute inset-0 flex items-center justify-center text-2xl"
            >
              <LoadingIcon />
            </div>
          </Transition>
        </div>
      </DrawnFrame>
    </RouterLink>

    <div class="mt-4 flex justify-between items-center">
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
      <div class="flex gap-2 justify-end grow">
        <IconLink :href="sketch.codepen" icon="codepen" />
        <IconLink :href="sketch.shadertoy" icon="shadertoy">
          <img src="/icon-shadertoy-57.png" alt="View on Shadertoy" />
        </IconLink>
        <IconLink :href="sketch.twitter" icon="twitter" />
        <IconLink :href="sketch.github" icon="github" />
      </div>
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
