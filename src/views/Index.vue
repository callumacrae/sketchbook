<script setup lang="ts">
import { onMounted, computed, ref } from 'vue';

interface RouteObject {
  path: string;
  name: string;
  meta: Record<string, any>;
}

onMounted(() => {
  document.body.style.background = 'white';
});

const preview = ref<RouteObject | null>(null);

const sketchModules = import.meta.glob('../sketches/*.{ts,glsl,vue}', {
  as: 'raw',
});
const sketchPromises = Object.entries(sketchModules).map(
  async ([filePath, module]) => {
    const path = '/' + filePath.split('/').pop()?.split('.').shift();

    const moduleText = await module();

    const jsMeta = moduleText.indexOf('export const meta =');
    if (jsMeta !== -1) {
      const metaStart = jsMeta + 7;
      const metaEnd = moduleText.indexOf(';', metaStart) + 1;

      const meta: Record<string, any> = eval(
        moduleText.slice(metaStart, metaEnd) + 'meta'
      );

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
        const value = line.slice(colonIndex + 1).trim();
        meta[key] = value;
      }

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
      const aDate = new Date(a.meta.date);
      const bDate = new Date(b.meta.date);
      return aDate.getTime() - bDate.getTime();
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
  <div class="main">
    <div class="index">
      <p class="toggle-favourites">
        View
        <label>
          <input v-model="shouldFilter" type="radio" :value="true" />
          <span>my favourites</span>
        </label>
        /
        <label>
          <input v-model="shouldFilter" type="radio" :value="false" />
          <span>all</span>
        </label>
      </p>

      <ul>
        <li v-for="route in filteredRoutes" :key="route.path">
          <i v-if="route.meta && route.meta.favourite" class="fav-icon">⭐️</i>
          <router-link :to="route.path" @mouseover="preview = route">
            {{ route.name || route.path }}
          </router-link>
        </li>
      </ul>
    </div>

    <div
      class="preview"
    >
      <h1>callum's sketchbook</h1>
      <p>
        disclaimer: some of this is real shitty, this is called "sketchbook" not
        "gallery"!
      </p>

      <iframe :src="preview?.path"></iframe>

      <!-- Added to the DOM even when empty for the transition -->
      <a
        v-if="preview?.meta?.link"
        :href="preview?.meta?.link"
        class="preview__link"
        target="_blank"
      >
        {{ preview?.meta?.link }}
      </a>
    </div>
  </div>
</template>

<script lang="ts">
export default {
  name: 'ViewIndex',
};
</script>

<style scoped>
.main {
  height: 80vh;
  display: flex;
  justify-content: center;

  font-family: 'The Happy Giraffe', sans-serif;
}

.index {
  width: 250px;
  overflow: auto;
}

h1 {
  margin-top: 0;
}

.toggle-favourites {
  color: #666;
  font-size: 0.8em;
}
.toggle-favourites input {
  display: none;
}
.toggle-favourites span {
  cursor: pointer;
}
.toggle-favourites input:checked + span {
  color: black;
}

ul {
  list-style-type: none;
  padding-left: 0;
}

li {
  margin: 1em 0;
}

a {
  color: inherit;
}

li:last-child {
  margin-bottom: 0;
}

.fav-icon {
  margin-right: 4px;
  font-style: normal;
}

.preview {
  display: flex;
  flex-direction: column;
  gap: 1em;

  margin-left: 100px;
  position: relative;

  width: 50vw;
}

.preview h1 {
  margin: 0;
}

.preview p {
  margin: 0;
}

.preview iframe {
  width: 50vw;
  height: calc(50vw / 16 * 9);

  background-color: white;
  border: 1px hsl(0, 0%, 80%) solid;
  transition: transform 400ms;
}

.preview__link {
  text-align: center;
}

@media only screen and (max-width: 768px) {
  .index {
    width: auto;
  }
  .preview {
    display: none;
  }
}
</style>
