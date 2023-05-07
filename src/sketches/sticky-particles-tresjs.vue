<script lang="ts" setup>
import { shallowRef, watch } from 'vue';
import { TresCanvas, useRenderLoop } from '@tresjs/core';
import { OrbitControls } from '@tresjs/cientos';
import type { TresInstance } from '@tresjs/core';
import * as THREE from 'three';

const props = defineProps<{
  preview?: boolean;
  animatingOverride?: string;
}>();

const particleCount = 1000;
const particlePosition = new Float32Array(particleCount * 3);

for (let i = 0; i < particleCount; i++) {
  particlePosition[i * 3] = Math.random() * 2 - 1;
  particlePosition[i * 3 + 1] = Math.random() * 2 - 1;
  particlePosition[i * 3 + 2] = Math.random() * 2 - 1;
}

const pointsRef = shallowRef<TresInstance | null>(null);
const { onLoop, pause, resume } = useRenderLoop();

onLoop(({ delta }) => {
  if (!pointsRef.value) return;

  const deltaFactor = Math.min(delta * 60, 3);

  for (let i = 0; i < particleCount; i++) {
    const yIndex = i * 3 + 1;
    particlePosition[yIndex] -= 0.002 * deltaFactor;

    if (particlePosition[yIndex] < -1) {
      particlePosition[yIndex] += 2;
    }
  }

  pointsRef.value.geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(particlePosition, 3)
  );
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
  <TresCanvas window-size clear-color="#34495E">
    <TresPerspectiveCamera :fov="30" :position="[0, 0, 2.5]" />
    <OrbitControls />
    <TresPoints ref="pointsRef">
      <TresBufferGeometry :position="[particlePosition, 3]" />
      <TresPointsMaterial :size="0.03" color="#41B883" />
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
