<script lang="ts" setup>
import { computed, ref } from 'vue';
import { drawFrame } from '@/utils/shapes/hand-drawn-frame';
import DrawnFrame from '@/components/DrawnFrame.vue';

const meta = {
  name: 'Handdrawn Frame Vue',
  date: '2023-03-03',
};

const frameCanvas = computed(() => {
  return drawFrame({
    width: width.value * 2,
    height: height.value * 2,
    lineWidth: lineWidth.value * 2,
    resolution: resolution.value * 2,
    wiggle: wiggle.value * 2,
    color: '#86198f',
  });
});
const frame = computed(() => {
  return frameCanvas.value.toDataURL();
});

const width = ref(400);
const height = ref(200);

const lineWidth = ref(4);
const resolution = ref(10);
const wiggle = ref(1);
</script>

<template>
  <div
    class="bg-fuchsia-100 flex items-center justify-center flex-col gap-4 w-screen h-screen"
  >
    <!-- <img -->
    <!--   :src="frame" -->
    <!--   :style="{ width: frameCanvas.width / 2 + 'px', height: frameCanvas.height / 2 + 'px' }" -->
    <!-- /> -->
    <div
      class="bg-fuchsia-300 p-4 flex flex-col gap-2 font-handwriting"
      :style="{
        width: width + 'px',
        height: height + 'px',
        border: `${lineWidth + wiggle * 2}px solid black`,
        borderImage: `url(${frame}) ${lineWidth * 2 + wiggle * 4}`,
        borderImageOutset: `${lineWidth}px`,
      }"
    >
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

    <DrawnFrame>
    hello
    </DrawnFrame>
  </div>
</template>
