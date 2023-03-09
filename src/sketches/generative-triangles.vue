<script setup>
import { onMounted, ref, watch } from 'vue';
import SimplexNoise from 'simplex-noise';

import simplexDistribution from '@/utils/distributions/simplex';
import { shuffle } from '@/utils/maths';
import * as random from '@/utils/random';

const _meta = {
  name: 'Generative triangles',
  date: '2020-05-10',
  tags: ['Canvas 2D', 'Generative art'],
  favourite: true,
};

const props = defineProps({
  preview: {
    type: Boolean,
    default: false,
  },
  animatingOverride: {
    type: String,
    default: undefined,
  },
});

/**
 *    /\
 *   A   B=A
 *  /__C__\
 */
function randomEquilateral(centroid, A) {
  const C = A * 0.8;

  const height = Math.sqrt(A ** 2 - (C / 2) ** 2);

  const a = [centroid.x + C / 2, centroid.y + height / 2];
  const b = [centroid.x - C / 2, centroid.y + height / 2];
  const c = [centroid.x, centroid.y - height / 2];

  return `M ${a.join(' ')} L ${b.join(' ')} L ${c.join(' ')} Z`;
}

const bgColor = ref(null);
const shapes = ref([]);

function paint(simplex, z, color, valueFormula, scaleFactor = 1 / 80) {
  const shrinkFactor = width.value < 600 ? 0.5 : 1;
  scaleFactor /= shrinkFactor;

  const distribution = simplexDistribution({
    width: width.value,
    height: height.value,
    scaleFactor,
    noise: (x, y) => simplex.noise3D(x, y, z),
  });

  distribution.forEach(({ x, y, value2 }) => {
    shapes.value.push({
      d: randomEquilateral({ x, y }, valueFormula(value2)),
      transform:
        shrinkFactor !== 1
          ? `translate(${x}, ${y}) scale(${shrinkFactor}) translate(${-x}, ${-y})`
          : undefined,
      fill: color,
    });
  });
}

const wrapperEl = ref(null);
const width = ref(0);
const height = ref(0);

const resizeObserver = ref(null);
onMounted(() => {
  if (typeof window === 'undefined') return;

  if ('ResizeObserver' in window) {
    resizeObserver.value = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry.borderBoxSize.length) {
        width.value = entry.borderBoxSize[0].inlineSize;
        height.value = entry.borderBoxSize[0].blockSize;
      }
    });

    if (wrapperEl.value) {
      resizeObserver.value.observe(wrapperEl.value);
    }
  }
});

watch(
  () => wrapperEl.value,
  (el, oldEl) => {
    if (!el) return;
    if (resizeObserver.value) {
      if (oldEl) resizeObserver.value.unobserve(oldEl);
      resizeObserver.value.observe(el);
    } else if (!('ResizeObserver' in window)) {
      width.value = el.clientWidth;
      height.value = el.clientHeight;
    }
  }
);

watch(
  () => [props.animatingOverride, width.value, height.value],
  () => {
    if (props.animatingOverride === 'false' && shapes.value.length) return;

    const colors = random.colorPalette4();
    bgColor.value = colors.splice(random.floorRange(0, 3), 1);

    shapes.value = [];

    const simplex = new SimplexNoise();

    const startT = Date.now();

    // This is REAL slow in Safari, so we stop it if it takes too long
    paint(simplex, 0, colors[0], (val) => val ** 3 * 100);
    if (Date.now() - startT < 1000)
      paint(simplex, 0.5, colors[1], (val) => val ** 3 * 100);
    if (Date.now() - startT < 1000)
      paint(simplex, 10, colors[2], (val) => val ** 3 * 100);
    if (Date.now() - startT < 1000)
      paint(simplex, 15, colors[0], (val) => val ** 3 * 100);
    if (Date.now() - startT < 1000)
      paint(simplex, 100, colors[1], (val) => val ** 2 * 70, 1 / 50);
    if (Date.now() - startT < 1500)
      paint(simplex, 110, colors[2], (val) => val ** 2 * 60, 1 / 50);
    shuffle(shapes.value);
  }
);
</script>

<template>
  <div ref="wrapperEl" :class="['w-full', preview ? 'h-full' : 'h-screen']">
    <svg class="w-full h-full" :style="{ background: bgColor }">
      <path v-for="(shape, i) in shapes" v-bind="shape" :key="`shape-${i}`" />
    </svg>
  </div>
</template>
