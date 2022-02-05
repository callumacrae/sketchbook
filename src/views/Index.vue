<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouteRecordRaw, useRouter } from 'vue-router';

const preview = ref<RouteRecordRaw | null>(null);
const previewLink = ref('');

const router = useRouter();
const routes = computed(() => {
  return router.options.routes.filter((route) => route.name !== 'home');
});

function previewRoute(route: RouteRecordRaw) {
  preview.value = route;

  if (route.meta && typeof route.meta.link === 'string') {
    previewLink.value = route.meta.link;
  }
}

function handleTransitionEnd() {
  if (previewLink.value && !preview.value?.meta?.link) {
    previewLink.value = '';
  }
}
</script>

<template>
  <div class="main">
    <div class="index">
      <ul>
        <li v-for="route in routes" :key="route.path">
          <i v-if="route.meta && route.meta.favourite" class="fav-icon">⭐️</i>
          <router-link :to="route.path" @mouseover="previewRoute(route)">
            {{ route.name || route.path }}
          </router-link>
        </li>
      </ul>
    </div>

    <div
      class="preview"
      :class="{ 'preview--has-link': preview?.meta?.link }"
      @transitionend="handleTransitionEnd"
    >
      <h1>Sketches</h1>
      <p>
        Disclaimer: this is called sketchbook for a reason - this is public to
        demonstrate my learning process, not my ability. A lot of this stuff is
        very bad!
      </p>
      <p>Old sketchbook <a href="https://sketchbook.macr.ae">here</a>.</p>

      <!-- Added to the DOM even when empty for the transition -->
      <a :href="previewLink" class="preview__link" target="_blank">
        {{ previewLink }}
      </a>
      <iframe :src="preview?.path"></iframe>
    </div>
  </div>
</template>

<style scoped>
.main {
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;

  font-family: sans-serif;
}

.index {
  margin-right: 100px;
}

h1 {
  margin-top: 0;
}

li {
  margin: 1em 0;
}

li:last-child {
  margin-bottom: 0;
}

.fav-icon {
  font-style: normal;
}

.preview {
  position: relative;

  width: 50vw;
}

.preview iframe {
  width: 50vw;
  height: calc(50vw / 16 * 9);
  margin-top: 2em;

  background-color: white;
  border: 1px hsl(0, 0%, 80%) solid;
  transition: transform 400ms;
}

.preview__link {
  position: absolute;
  top: 100%;
  transform: translateY(-25px);
  transition: transform 400ms;

  display: block;
  width: 100%;

  text-align: center;
}

.preview--has-link iframe {
  transform: translateY(-12.5px);
}

.preview--has-link a {
  transform: translateY(0);
}
</style>
