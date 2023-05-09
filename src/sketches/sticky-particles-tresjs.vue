<script lang="ts" setup>
import { computed, ref, shallowRef, watch } from 'vue';
import { TresCanvas, useRenderLoop } from '@tresjs/core';
import { OrbitControls } from '@tresjs/cientos';
import { BufferAttribute, PointsMaterial, type Shader } from 'three';
import { easePolyIn, easePolyInOut } from 'd3-ease';
import BezierEasing from 'bezier-easing';
import {
  useCycleList,
  useElementSize,
  useIntervalFn,
  useMemoize,
} from '@vueuse/core';
import type { TresInstance } from '@tresjs/core';

import NoiseMachine, {
  BandedNoiseGenerator,
  CustomNoiseGenerator,
  SimplexNoiseGenerator,
} from '@/utils/noise';
import * as random from '@/utils/random';
import { doWorkOffscreen, ensureCanvas2DContext } from '@/utils/canvas/utils';
import { clamp } from '@/utils/maths';

// Used to store particles that aren't currently on screen
const JAIL = 10000;

const props = defineProps<{
  preview?: boolean;
  animatingOverride?: string;
}>();

const wrapperEl = ref<HTMLElement | null>(null);
const { width, height } = useElementSize(wrapperEl);

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
const textCycleTime = 10e3;

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

const initTextMemoized = useMemoize(initText);
watch([width, height], initTextMemoized.clear);
const { state: text, next: nextText } = useCycleList(textValues);
useIntervalFn(nextText, textCycleTime);
const textTextureData = computed(() => {
  if (!width.value || !height.value) return null;
  return initTextMemoized({
    width: width.value,
    height: height.value,
    text: text.value,
    textSize: props.preview ? 80 : 250,
  });
});
const textAtUv = (u: number, v: number) => {
  if (u < 0 || u > 1 || v < 0 || v > 1) return 0;
  if (!textTextureData.value) return 0;

  const { data, width, height } = textTextureData.value;
  const tx = Math.min(Math.floor(u * width), width - 1);
  const ty = Math.min(Math.floor(v * height), height - 1);
  return data[(ty * width + tx) * 4];
};

const pointsRef = shallowRef<TresInstance | null>(null);
const { onLoop, pause, resume } = useRenderLoop();

const pointsMaterial = new PointsMaterial();
pointsMaterial.onBeforeCompile = (shader: Shader) => {
  shader.vertexShader = shader.vertexShader
    .replace(
      'uniform float size;',
      `uniform float size; attribute float size_override;`
    )
    .replace('gl_PointSize = size;', 'gl_PointSize = size_override;');
};

const lastRelease = ref(-1000);
onLoop(({ delta, elapsed }) => {
  // Workaround for https://github.com/Tresjs/tres/issues/251
  // The `lastRelease` check is to work around issue where if nothing is added
  // on first frame, everything breaks
  if (props.animatingOverride === 'false' && lastRelease.value !== -1000)
    return;

  if (!pointsRef.value) return;
  const deltaFactor = Math.min(delta * 60, 3);
  const acceleration = accelerationNoiseMachine.get(elapsed) * deltaFactor;

  // Only release 60 times per second max to increase banding on 120fps monitors
  const skipRelease = elapsed - lastRelease.value < 1 / 61;
  // Ramp up release so that not everything is released at once
  const rampedReleaseVal = clamp([0.01, 1], elapsed / 4);
  const addChance =
    Math.min(addChanceNoiseMachine.get(elapsed / deltaFactor) * 10, 0.6) *
    rampedReleaseVal;
  if (!skipRelease) {
    lastRelease.value = elapsed;
  }

  const displayRatio =
    width.value && height.value ? width.value / height.value : 1;

  for (let i = 0; i < particleCount; i++) {
    if (particlePosition[i * 3 + 1] === JAIL) {
      if (!skipRelease && random.chance(addChance)) {
        particlePosition[i * 3] = random.range(-1, 1) * displayRatio;
        particlePosition[i * 3 + 1] = acceleration < 0 ? 1 : -1;
        particlePosition[i * 3 + 2] = random.range(-1, 1) * 0.1;
        particleVelocity[i] = 0;
      } else {
        continue;
      }
    }

    const resistance = textAtUv(
      particlePosition[i * 3] / displayRatio / 2 + 0.5,
      1 - (particlePosition[i * 3 + 1] / 2 + 0.5)
    );
    if (resistance > 0.5) {
      particleVelocity[i] = acceleration * 1.5;
    } else {
      particleVelocity[i] += acceleration;
    }

    particlePosition[i * 3 + 1] += particleVelocity[i] * deltaFactor;

    if (Math.abs(particlePosition[i * 3 + 1]) > 1.2) {
      particlePosition[i * 3 + 1] = JAIL;
    }
  }

  pointsRef.value.geometry.setAttribute(
    'position',
    new BufferAttribute(particlePosition, 3)
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

function initText({
  width,
  height,
  text,
  textSize,
}: {
  width: number;
  height: number;
  text: string | [string, string];
  textSize: number;
}) {
  const canvas = doWorkOffscreen(width, height, (ctx) => {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = 'white';
    ctx.font = `100 ${textSize}px sans-serif`;
    ctx.textAlign = 'center';

    if (Array.isArray(text)) {
      const textHeight = ctx.measureText(text[0]).actualBoundingBoxAscent;
      ctx.fillText(text[0], width / 2, height / 2);
      ctx.fillText(text[1], width / 2, height / 2 + textHeight);
    } else {
      const textHeight = ctx.measureText(text).actualBoundingBoxAscent;
      ctx.fillText(text, width / 2, height / 2 + textHeight / 2);
    }
  });

  const ctx = canvas.getContext('2d');
  ensureCanvas2DContext(ctx);
  return ctx.getImageData(0, 0, width, height);
}

function initAddChanceNoiseMachine() {
  const noiseMachine = new NoiseMachine();

  const generalNoiseFactor = 0.02;
  const fastNoise = new SimplexNoiseGenerator({
    inputFactor: 1,
    range: [0, 1],
  });
  const slowNoise = new SimplexNoiseGenerator({
    inputFactor: 0.05,
    range: [0, generalNoiseFactor],
    factor: fastNoise,
  });
  noiseMachine.add(slowNoise);

  const bandedNoiseGenerator = new BandedNoiseGenerator({
    bandFreqency: new SimplexNoiseGenerator({
      inputFactor: 0.01,
      range: [200, 250],
    }),
    bandSize: 50,
    factor: new SimplexNoiseGenerator({
      inputFactor: 1,
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
    inputFactor: 0.3,
    easing: (x) => easing3(easing2(easing1(x))),
    factor: -0.001,
  });
  noiseMachine.add(noiseBase);

  // This noise adds a bit of variation to the previous slower one
  const fastNoise = new SimplexNoiseGenerator({
    inputFactor: 0.3,
    factor: 0.0004,
  });
  noiseMachine.add(fastNoise);

  return noiseMachine;
}
</script>

<template>
  <div
    ref="wrapperEl"
    class="relative"
    :class="preview ? 'w-full h-full' : 'w-screen h-screen'"
  >
    <TresCanvas clear-color="#34495E">
      <TresPerspectiveCamera :fov="5" :position="[0, 0, 20]" />
      <OrbitControls />
      <TresPoints ref="pointsRef">
        <TresBufferGeometry
          :position="[particlePosition, 3]"
          :size_override="[particleSize, 1]"
        />
        <primitive
          :object="pointsMaterial"
          :size-attenuation="false"
          color="#41b883"
        />
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
