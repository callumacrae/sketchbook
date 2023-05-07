<script lang="ts" setup>
import { shallowRef, watch } from 'vue';
import { TresCanvas, useRenderLoop } from '@tresjs/core';
import * as THREE from 'three';

const props = defineProps<{
  preview?: boolean;
  animatingOverride?: string;
}>();

const particleCount = 100;
const particlePosition = new Float32Array(particleCount * 3);

for (let i = 0; i < particleCount; i++) {
  particlePosition[i] = Math.random() - 0.5;
  particlePosition[i + 1] = Math.random() - 0.5;
  particlePosition[i + 2] = Math.random() - 0.5;
}

const pointsRef = shallowRef(null);
const { onLoop, pause, resume } = useRenderLoop();

onLoop(({ delta }) => {
  if (!pointsRef.value) return;
  // pointsRef.value.geometry.setAttribute(
  //   'position',
  //   new THREE.BufferAttribute(particlePosition, 3)
  // );
});

watch(
  () => props.animatingOverride,
  (animatingOverride) => {
    if (animatingOverride === 'false') {
      pause();
    } else {
      resume();
    }
  }
);
</script>

<template>
  <TresCanvas window-size>
    <TresPerspectiveCamera :position="[0, 0, 5]" />
    <TresPoints ref="pointsRef">
      <TresBufferGeometry :position="[particlePosition, 3]" />
      <TresPointsMaterial :size="5" :size-attenuation="false" color="red" />
    </TresPoints>
  </TresCanvas>
</template>

<script lang="ts">
export const meta = {
  name: 'Sticky particles (TresJS)',
  date: '2023-05-07',
  tags: ['Three.js', 'TresJS', 'WebGL', 'Particles'],
};
</script>
