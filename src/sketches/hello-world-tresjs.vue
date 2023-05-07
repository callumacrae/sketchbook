<script lang="ts" setup>
import { shallowRef, watch } from 'vue';
import { TresCanvas, useRenderLoop } from '@tresjs/core';
import { OrbitControls } from '@tresjs/cientos';
import type { TresInstance } from '@tresjs/core';

const props = defineProps<{
  preview?: boolean;
  animatingOverride?: string;
}>();

const meshRef = shallowRef<TresInstance>(null);

const { onLoop, pause, resume } = useRenderLoop();
onLoop(({ delta }) => {
  if (!meshRef.value) return;
  meshRef.value.rotation.x += delta;
  meshRef.value.rotation.y += delta * 0.5;
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
    <OrbitControls />
    <TresMesh ref="meshRef">
      <TresTorusGeometry :args="[1, 0.5, 16, 32]" />
      <TresMeshPhongMaterial color="orange" />
    </TresMesh>
    <TresDirectionalLight :intensity="0.5" :position="[0, 1, 5]" />
    <TresAmbientLight :intensity="0.5" />
  </TresCanvas>
</template>

<script lang="ts">
export const meta = {
  name: 'Hello world (TresJS)',
  date: '2023-05-06',
  tags: ['Three.js', 'TresJS', 'Hello World'],
};
</script>
