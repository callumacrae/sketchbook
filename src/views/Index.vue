<script lang="ts" setup>
import { onMounted, computed, ref } from 'vue';

import SketchPreview from '@/components/SketchPreview.vue';
import LoadQueue from '@/utils/load-queue';
import parseSketchMeta, { isSketchWithPath } from '@/utils/sketch-parsing';
import type { SketchWithPath } from '@/utils/sketch-parsing';

onMounted(() => {
  document.body.style.removeProperty('background');
});

const sketches = ref<SketchWithPath[]>([]);
const sketchModules = import.meta.glob('../sketches/*.{ts,glsl,vue}', {
  as: 'raw',
  eager: true,
});
sketches.value = Object.entries(sketchModules)
  .map(([filePath, moduleText]) => parseSketchMeta(moduleText, filePath))
  .filter(isSketchWithPath)
  .sort((a, b) => b.date.diff(a.date));

const shouldFilter = ref(true);
const filteredRoutes = computed(() => {
  return shouldFilter.value
    ? sketches.value.filter((route) => route.favourite)
    : sketches.value;
});

const loadQueue = new LoadQueue({
  prioritised: true,
  maxConcurrent: 3,
  preloadAhead: 3,
});
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 md:px-8 my-8 md:my-12 font-handwriting">
    <h1 class="text-3xl">
      callum's sketchbook
      <a href="https://github.com/callumacrae/sketchbook" target="_blank">
        <span class="icon-github"></span>
      </a>
    </h1>
    <p>a collection of sketches, experiments, and other things i've made</p>

    <div class="mt-6 md:mt-10 flex justify-between text-sm text-zinc-500">
      <p>
        View
        <label class="cursor-pointer">
          <input
            v-model="shouldFilter"
            type="radio"
            :value="true"
            class="hidden peer"
          />
          <span class="peer-checked:text-zinc-800">my favourites</span>
        </label>
        /
        <label class="cursor-pointer">
          <input
            v-model="shouldFilter"
            type="radio"
            :value="false"
            class="hidden peer"
          />
          <span class="peer-checked:text-zinc-800">all</span>
        </label>
      </p>
      <p class="hidden md:block">Hover over a sketch to preview it</p>
    </div>

    <div
      class="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-10"
    >
      <SketchPreview
        v-for="route in filteredRoutes"
        :key="route.path"
        :sketch="route"
        :load-queue="loadQueue"
      />
    </div>
  </div>
</template>

<script lang="ts">
export default {
  name: 'ViewIndex',
};
</script>
