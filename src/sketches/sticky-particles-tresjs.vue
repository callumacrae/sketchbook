<script lang="ts" setup>
import { shallowRef, watch } from 'vue';
import { TresCanvas, useRenderLoop } from '@tresjs/core';
import { OrbitControls } from '@tresjs/cientos';
import * as THREE from 'three';
import { easePolyIn, easePolyInOut } from 'd3-ease';
import BezierEasing from 'bezier-easing';
import type { TresInstance } from '@tresjs/core';

import NoiseMachine, {
  BandedNoiseGenerator,
  CustomNoiseGenerator,
  SimplexNoiseGenerator,
} from '@/utils/noise';
import * as random from '@/utils/random';

const props = defineProps<{
  preview?: boolean;
  animatingOverride?: string;
}>();

const particleCount = 1000;
const particlePosition = new Float32Array(particleCount * 3);
const particleVelocity = new Float32Array(particleCount);

for (let i = 0; i < particleCount; i++) {
  particlePosition[i * 3] = random.range(-1, 1);
  particlePosition[i * 3 + 1] = random.range(-1, 1);
  particlePosition[i * 3 + 2] = random.range(-1, 1);
  particleVelocity[i] = 0;
}

const pointsRef = shallowRef<TresInstance | null>(null);
const { onLoop, pause, resume } = useRenderLoop();

onLoop(({ delta, elapsed }) => {
  if (!pointsRef.value) return;

  const deltaFactor = Math.min(delta * 60, 3);
  const acceleration = accelerationNoiseMachine.get(elapsed * 1000) * 0.5;

  for (let i = 0; i < particleCount; i++) {
    particleVelocity[i] += acceleration * deltaFactor;

    const posYIndex = i * 3 + 1;
    particlePosition[posYIndex] += particleVelocity[i] * deltaFactor;

    if (particlePosition[posYIndex] < -1) {
      particlePosition[posYIndex] += 2;
      particleVelocity[i] = 0;
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

function initAddChanceNoiseMachine() {
  const noiseMachine = new NoiseMachine();

  const generalNoiseFactor = 0.05;
  const fastNoise = new SimplexNoiseGenerator({
    inputFactor: 0.001,
    range: [0, 1],
  });
  const slowNoise = new SimplexNoiseGenerator({
    inputFactor: 0.00005,
    range: [0, generalNoiseFactor],
    factor: fastNoise,
  });
  noiseMachine.add(slowNoise);

  const bandedNoiseGenerator = new BandedNoiseGenerator({
    bandFreqency: new SimplexNoiseGenerator({
      inputFactor: 0.00001,
      range: [200, 250],
    }),
    bandSize: 50,
    factor: new SimplexNoiseGenerator({
      inputFactor: 0.001,
      range: [0, 1],
      factor(x) {
        const slowNoiseOut = slowNoise.get(x);
        return (
          0.2 + ((generalNoiseFactor - slowNoiseOut) / generalNoiseFactor) * 0.6
        );
      },
      easing: easePolyIn.exponent(5),
    }),
    easing: easePolyInOut.exponent(3),
  });
  noiseMachine.add(bandedNoiseGenerator);

  const occasionalHeavyNoise = new CustomNoiseGenerator(() => {
    return random.chance(0.007) ? 100000 : 0;
  });
  noiseMachine.add(occasionalHeavyNoise);

  return noiseMachine;
}

function initAccelerationNoiseMachine() {
  const noiseMachine = new NoiseMachine();

  // This noise decides whether the value will be above or below zero, but
  // tries to keep it from stay at zero too long
  const easing1 = BezierEasing(0.11, 0, 0, 1);
  // lower number = less likely to accelerate upwards
  const easing2 = easePolyIn.exponent(0.7);
  // higher number = steeper gradient, less likely to sit around zero
  const easing3 = easePolyInOut.exponent(6);
  const noiseBase = new SimplexNoiseGenerator({
    inputFactor: 0.0003,
    easing: (x) => easing3(easing2(easing1(x))),
    factor: -0.0008,
  });
  noiseMachine.add(noiseBase);

  // This noise adds a bit of variation to the previous slower one
  const fastNoise = new SimplexNoiseGenerator({
    inputFactor: 0.001,
    factor: 0.0002,
  });
  noiseMachine.add(fastNoise);

  return noiseMachine;
}

const accelerationNoiseMachine = initAccelerationNoiseMachine();
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
