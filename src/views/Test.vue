<script lang="ts" setup>
import { ref } from 'vue';

import MovingMirrorsSketch from '@/sketches/moving-mirrors';
import ExplodingTextSketch from '@/sketches/exploding-text-3d';

const mouseoverMovingMirrors = ref('false');
const mouseoverExplodingText = ref('false');
</script>

<template>
  <div class="h-screen flex items-center justify-center gap-4 text-center">
    <div
      class="w-4/12"
      @mouseenter="mouseoverMovingMirrors = 'true'"
      @mouseleave="mouseoverMovingMirrors = 'false'"
    >
      <MovingMirrorsSketch
        class="aspect-video mb-2"
        preview
        :animating-override="mouseoverMovingMirrors"
      />
      <RouterLink to="/moving-mirrors" class="underline text-sky-600">
        View full screen
      </RouterLink>
    </div>
    <div
      class="w-4/12"
      @mouseenter="mouseoverExplodingText = 'true'"
      @mouseleave="mouseoverExplodingText = 'false'"
    >
      <ExplodingTextSketch
        class="aspect-video mb-2"
        preview
        :animating-override="mouseoverExplodingText"
      />
      <RouterLink to="/exploding-text-3d" class="underline text-sky-600">
        View full screen
      </RouterLink>
    </div>
  </div>
</template>
