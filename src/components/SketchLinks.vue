<script lang="ts" setup>
import { useRoute, useRouter } from 'vue-router';

import IconLink from './IconLink.vue';
import type { Sketch } from '@/utils/sketch-parsing';

defineProps<{
  sketch: Sketch;
  size: 'small' | 'medium';
}>();

const route = useRoute();
const router = useRouter();

function goBack() {
  const lastPath = router.options.history.state.back;
  if (lastPath) {
    router.back();
  } else {
    router.push('/');
  }
}
</script>

<template>
  <div
    class="flex gap-2"
    :class="size === 'small' ? 'text-xl' : 'text-xl md:text-2xl'"
  >
    <IconLink v-if="route.path !== '/'" :onClick="goBack" icon="circle-left" />
    <IconLink :href="sketch.codepen" icon="codepen" />
    <IconLink
      :href="sketch.shadertoy"
      icon="shadertoy"
      :class="{
        'w-5 h-5': true,
        'md:w-6 md:h-6': size === 'medium',
      }"
    />
    <IconLink :href="sketch.twitter" icon="twitter" />
    <IconLink :href="sketch.github" icon="github" />
  </div>
</template>
