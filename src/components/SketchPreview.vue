<script lang="ts" setup>
import { ref, shallowRef, watch } from 'vue';

import DrawnFrame from '@/components/DrawnFrame.vue';
import IconLink from '@/components/IconLink.vue';

const props = defineProps<{
  sketch: {
    path: string;
    name: string;
    meta: Record<string, any>;
  };
}>();

const animating = ref(false);
const sketchPreview = shallowRef<Component | null>(null);
watch(
  () => animating.value,
  async () => {
    if (animating.value && !sketchPreview.value) {
      const loadedComponent = await props.sketch.meta.component();
      sketchPreview.value = loadedComponent.default;
    }
  }
);
</script>

<template>
  <div>
    <RouterLink :to="sketch.path">
      <DrawnFrame
        class="border-zinc-800"
        :line-width="3"
        no-border
        @mouseenter="animating = true"
        @mouseleave="animating = false"
      >
        <div
          class="w-full aspect-video bg-zinc-300 flex items-center justify-center overflow-hidden"
        >
          <div v-if="sketchPreview">
            <component
              :is="sketchPreview"
              preview
              :animating-override="animating"
            />
          </div>
          <p v-else class="text-center">Hover to<br />load preview</p>
        </div>
      </DrawnFrame>
    </RouterLink>

    <div class="mt-4 flex justify-between items-center">
      <RouterLink :to="sketch.path">
        <h2>
          <span v-if="sketch.meta?.favourite">
            <span aria-hidden="true">⭐️</span>
            <span class="sr-only">Favourite:</span>
          </span>
          {{ sketch.name || sketch.path }}
        </h2>
      </RouterLink>

      <div v-if="sketch.meta?.date" class="text-xs text-zinc-500">
        {{ sketch.meta.date.format('Do MMMM YYYY') }}
      </div>
    </div>

    <div v-if="sketch.meta" class="flex justify-between gap-4 mt-2">
      <div v-if="sketch.meta?.tags" class="flex flex-wrap gap-2">
        <div
          v-for="tag in sketch.meta?.tags"
          :key="tag"
          class="inline-block text-xs px-1.5 py-1 bg-zinc-600 text-zinc-50 rounded-sm"
        >
          {{ tag }}
        </div>
      </div>
      <div class="flex gap-2 justify-end grow">
        <IconLink :href="sketch.meta.codepen" icon="codepen" />
        <IconLink :href="sketch.meta.shadertoy" icon="shadertoy">
          <img src="/icon-shadertoy-57.png" alt="View on Shadertoy" />
        </IconLink>
        <IconLink :href="sketch.meta.twitter" icon="twitter" />
        <IconLink :href="sketch.meta.github" icon="github" />
      </div>
    </div>
  </div>
</template>
