<script lang="ts" setup>
import { onMounted, computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import dayjs from 'dayjs';
import advancedFormat from 'dayjs/plugin/advancedFormat';

import SketchPreview from '@/components/SketchPreview.vue';

// TODO: replace with something better
interface RouteObject {
  path: string;
  name: string;
  meta: Record<string, any>;
}

dayjs.extend(advancedFormat);

onMounted(() => {
  document.body.style.removeProperty('background');
});

const router = useRouter();
function finishMeta(meta: Record<string, any>, filePath: string) {
  if (meta.date) {
    meta.date = dayjs(meta.date);
  }
  meta.github = filePath.replace(
    '..',
    'https://github.com/callumacrae/sketchbook/blob/main/src'
  );
  if (meta.tags && typeof meta.tags === 'string') {
    meta.tags = meta.tags.split(',').map((tag) => tag.trim());
  }

  // TODO: clean up
  const path = '/' + filePath.split('/').pop()?.split('.').shift();

  const route = router.getRoutes().find((route) => route.path === path);
  meta.component = route?.components.default;
}

const sketchModules = import.meta.glob('../sketches/*.{ts,glsl,vue}', {
  as: 'raw',
});
const sketchPromises = Object.entries(sketchModules).map(
  async ([filePath, module]) => {
    const path = '/' + filePath.split('/').pop()?.split('.').shift();

    const moduleText = await module();

    let jsMeta = moduleText.indexOf('const meta =');
    if (jsMeta === -1) {
      jsMeta = moduleText.indexOf('const _meta =');
    }
    if (jsMeta !== -1) {
      const metaEnd = moduleText.indexOf(';', jsMeta) + 1;

      const meta: Record<string, any> = eval(
        moduleText.slice(jsMeta, metaEnd).replace('_meta', 'meta') + 'meta'
      );
      finishMeta(meta, filePath);

      return { path, meta };
    }

    const glslMeta = moduleText.indexOf('// name:');
    if (glslMeta !== -1) {
      const metaEnd = moduleText.indexOf('\n\n', glslMeta);
      const metaText = moduleText.slice(glslMeta, metaEnd).split('\n');

      const meta: Record<string, any> = {};

      for (const line of metaText) {
        const colonIndex = line.indexOf(':');
        const key = line.slice(3, colonIndex);
        let value = line.slice(colonIndex + 1).trim();
        meta[key] = value;
      }
      finishMeta(meta, filePath);

      return { path, meta };
    }
  }
);

const routes = ref<RouteObject[]>([]);
Promise.all(sketchPromises).then((sketches) => {
  routes.value = sketches
    .filter((sketch): sketch is RouteObject => !!sketch)
    .map((sketch) => ({
      path: sketch.path,
      name: sketch.meta.name,
      meta: sketch.meta,
    }))
    .sort((a, b) => {
      return b.meta.date.diff(a.meta.date);
    });
});

const shouldFilter = ref(true);
const filteredRoutes = computed(() => {
  return shouldFilter.value
    ? routes.value.filter((route) => route.meta?.favourite)
    : routes.value;
});
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 md:px-8 my-8 font-handwriting">
    <h1 class="text-3xl">
      callum's sketchbook
      <a href="https://github.com/callumacrae/sketchbook" target="_blank">
        <span class="icon-github"></span>
      </a>
    </h1>
    <p>a collection of sketches, experiments, and other things i've made</p>

    <p class="toggle-favourites mt-6 text-sm text-zinc-500">
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

    <div
      class="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-10"
    >
      <SketchPreview
        v-for="route in filteredRoutes"
        :key="route.path"
        :sketch="route"
      />
    </div>
  </div>
</template>

<script lang="ts">
export default {
  name: 'ViewIndex',
};
</script>
