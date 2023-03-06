<script lang="ts" setup>
import { ref } from 'vue';
import DrawnFrame from '@/components/DrawnFrame.vue';

const _meta = {
  name: 'Handdrawn Frame Vue',
  date: '2023-03-03',
  tags: ['Vue component'],
};

const width = ref(window?.innerWidth > 800 ? 600 : 400);
const height = ref(window?.innerWidth > 800 ? 400 : 300);

const lineWidth = ref(4);
const resolution = ref(10);
const wiggle = ref(1);
</script>

<template>
  <div
    class="bg-fuchsia-100 flex items-center justify-center flex-col gap-4 w-screen h-screen"
  >
    <DrawnFrame
      :line-width="lineWidth"
      :resolution="resolution"
      :wiggle="wiggle"
      class="border-fuchsia-800 bg-fuchsia-300 p-4 flex items-center justify-center font-handwriting"
      :style="{ width: width + 'px', height: height + 'px' }"
    >
      <div class="flex flex-col gap-2">
        <p>Width: <input class="px-1" type="number" v-model="width" /></p>
        <p>Height: <input class="px-1" type="number" v-model="height" /></p>
        <p>
          Line width: <input class="px-1" type="number" v-model="lineWidth" />
        </p>
        <p>
          Resolution: <input class="px-1" type="number" v-model="resolution" />
        </p>
        <p>Wiggle: <input class="px-1" type="number" v-model="wiggle" /></p>
      </div>
    </DrawnFrame>
  </div>
</template>
