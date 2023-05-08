<script lang="ts" setup>
import { computed, shallowRef, watch } from 'vue';
import { TresCanvas, useRenderLoop, extend as extendTres } from '@tresjs/core';
import { OrbitControls } from '@tresjs/cientos';
import * as THREE from 'three';
import { easePolyIn, easePolyInOut } from 'd3-ease';
import BezierEasing from 'bezier-easing';
import { useCycleList, useIntervalFn, useMemoize } from '@vueuse/core';
import type { TresInstance } from '@tresjs/core';

import NoiseMachine, {
  BandedNoiseGenerator,
  CustomNoiseGenerator,
  SimplexNoiseGenerator,
} from '@/utils/noise';
import * as random from '@/utils/random';
import { doWorkOffscreen, ensureCanvas2DContext } from '@/utils/canvas/utils';

const JAIL = 10000;

const props = defineProps<{
  preview?: boolean;
  animatingOverride?: string;
}>();

const width = window.innerWidth;
const height = window.innerHeight;

const particleCount = 10000;
const particleSizeBase = props.preview ? 3 : 7;
const particleSizeVariance = props.preview ? 1 : 1.5;

const textValues: (string | [string, string])[] = [
  ['Vue.js', 'London'],
  ['Vue.js', 'Live'],
  'Evan You',
  ['Michael', 'Thiessen'],
  ['Jessica', 'Sachs'],
  ['Eduardo San', 'Martin Morote'],
  ['Alba Silvente', 'Fuentes'],
  'Daniel Roe',
  ['Markus', 'Oberlehner'],
  ['Sebastien', 'Chopin'],
  ['Lucie', 'Haberer'],
  'Tim Benniks',
];
const textCycleTime = 7e3;

const particlePosition = new Float32Array(particleCount * 3);
const particleVelocity = new Float32Array(particleCount);
const particleSize = new Float32Array(particleCount);

for (let i = 0; i < particleCount; i++) {
  particlePosition[i * 3 + 1] = JAIL;
  particleVelocity[i] = 0;
  particleSize[i] =
    particleSizeBase + random.range(-1, 1) * particleSizeVariance;
}

const addChanceNoiseMachine = initAddChanceNoiseMachine();
const accelerationNoiseMachine = initAccelerationNoiseMachine();

const initMemoizeBackground = useMemoize(initBackground);
const { state: text, next: nextText } = useCycleList(textValues);
useIntervalFn(nextText, textCycleTime);
const textTexData = computed(() => {
  return initMemoizeBackground({
    text: text.value,
    textSize: 200,
  });
});
const textAtUv = (u: number, v: number) => {
  if (u < 0 || u > 1 || v < 0 || v > 1) return 0;

  const { data, width, height } = textTexData.value;
  const tx = Math.min(Math.floor(u * width), width - 1);
  const ty = Math.min(Math.floor(v * height), height - 1);
  return data[(ty * width + tx) * 4];
};

const pointsRef = shallowRef<TresInstance | null>(null);
const { onLoop, pause, resume } = useRenderLoop();

class PointsWithSizeMaterial extends THREE.PointsMaterial {
  onBeforeCompile(shader: THREE.Shader) {
    shader.vertexShader = shader.vertexShader
      .replace(
        'uniform float size;',
        `uniform float size; attribute float size_override;`
      )
      .replace('gl_PointSize = size;', 'gl_PointSize = size_override;');
  }
}
extendTres({ PointsWithSizeMaterial });

const lastRelease = shallowRef(-1000);
onLoop(({ delta, elapsed }) => {
  if (!pointsRef.value) return;

  const deltaFactor = Math.min(delta * 60, 3);
  const acceleration =
    accelerationNoiseMachine.get(elapsed * 1000) * deltaFactor * 2;

  // Only release 60 times per second max to increase banding on 120fps monitors
  const skipRelease = elapsed - lastRelease.value < 1 / 61;
  const addChance = skipRelease
    ? 0
    : Math.min(
        addChanceNoiseMachine.get((elapsed * 1000) / deltaFactor) * 35,
        0.6
      );
  if (!skipRelease) {
    lastRelease.value = elapsed;
  }

  for (let i = 0; i < particleCount; i++) {
    const posYIndex = i * 3 + 1;
    if (particlePosition[posYIndex] === JAIL) {
      if (random.chance(addChance)) {
        particlePosition[i * 3] = (random.range(-1, 1) * width) / height;
        particlePosition[posYIndex] = 1;
        particlePosition[i * 3 + 2] = random.range(-1, 1) * 0.1;
        particleVelocity[i] = 0;
      } else {
        continue;
      }
    }

    const resistance = textAtUv(
      ((particlePosition[i * 3] / width) * height) / 2 + 0.5,
      1 - (particlePosition[posYIndex] / 2 + 0.5)
    );
    if (resistance > 0.5) {
      particleVelocity[i] = acceleration * 1.5;
    } else {
      particleVelocity[i] += acceleration;
    }

    particlePosition[posYIndex] += particleVelocity[i] * deltaFactor;

    if (Math.abs(particlePosition[posYIndex]) > 1.2) {
      particlePosition[posYIndex] = JAIL;
    }
  }

  pointsRef.value.geometry.setAttribute(
    'size_override',
    new THREE.BufferAttribute(particleSize, 1)
  );
  pointsRef.value.geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(particlePosition, 3)
  );

  // Calling pause() in immediate watcher doesn't work as expected
  // https://github.com/Tresjs/tres/issues/251
  if (props.animatingOverride === 'false') {
    setTimeout(() => {
      pause();
    }, 100);
  }
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

function initBackground({
  text,
  textSize,
}: {
  text: string | [string, string];
  textSize: number;
}) {
  // TODO: do we need to shrink for perf?
  const canvasWidth = width;
  const canvasHeight = height;

  const canvas = doWorkOffscreen(canvasWidth, canvasHeight, (ctx) => {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    ctx.fillStyle = 'white';
    ctx.font = `100 ${textSize}px sans-serif`;
    ctx.textAlign = 'center';

    if (Array.isArray(text)) {
      const textHeight = ctx.measureText(text[0]).actualBoundingBoxAscent;
      ctx.fillText(text[0], canvasWidth / 2, canvasHeight / 2);
      ctx.fillText(text[1], canvasWidth / 2, canvasHeight / 2 + textHeight);
    } else {
      const textHeight = ctx.measureText(text).actualBoundingBoxAscent;
      ctx.fillText(text, canvasWidth / 2, canvasHeight / 2 + textHeight / 2);
    }
  });

  const ctx = canvas.getContext('2d');
  ensureCanvas2DContext(ctx);
  return ctx.getImageData(0, 0, canvasWidth, canvasHeight);
}

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
</script>

<template>
  <div
    class="relative"
    :class="preview ? 'w-full h-full' : 'w-screen h-screen'"
  >
    <TresCanvas clear-color="#34495E">
      <TresPerspectiveCamera :fov="5" :position="[0, 0, 20]" />
      <OrbitControls />
      <TresPoints ref="pointsRef">
        <TresBufferGeometry :position="[particlePosition, 3]" />
        <TresPointsWithSizeMaterial :size-attenuation="false" color="#41B883" />
      </TresPoints>
    </TresCanvas>
    <div
      v-if="!preview"
      class="absolute bottom-0 right-0 m-4 text-white text-right font-handwriting text-lg text-gray-300"
    >
      <p>
        created by
        <a href="https://twitter.com/callumacrae" target="_blank">
          @callumacrae
        </a>
      </p>
      <p>
        powered by <a href="https://vuejs.org/" target="_blank">Vue</a> +
        <a href="https://tresjs.org/" target="_blank">TresJS</a>
        ❤️
      </p>
    </div>
  </div>
</template>

<script lang="ts">
export const meta = {
  name: 'Sticky particles (TresJS)',
  date: '2023-05-07',
  tags: ['Three.js', 'TresJS', 'WebGL', 'Particles'],
};
</script>
