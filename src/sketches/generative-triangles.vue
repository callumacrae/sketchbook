<template>
  <svg>
    <path v-for="(shape, i) in shapes" v-bind="shape" :key="`shape-${i}`" />
  </svg>
</template>

<script>
import SimplexNoise from 'simplex-noise';
import simplexDistribution from '../utils/distributions/simplex.ts';
import { shuffle } from '../utils/maths.ts';
import { rand4 } from '../utils/colors.ts';
import { randomEquilateral } from '../utils/shapes/triangles';

export const meta = {
  name: 'Generative triangles',
  date: '2020-05-10',
  tags: ['Canvas 2D', 'Generative art'],
  favourite: true,
};

const colors = rand4();
const backgroundColor = colors.splice(Math.floor(Math.random() * 3), 1);
document.body.style.backgroundColor = backgroundColor;

const simplex = new SimplexNoise();

export default {
  data: () => ({
    shapes: [],
    z: 0,
  }),
  mounted() {
    this.paint(0, colors[0], (val) => val ** 3 * 100);
    this.paint(0.5, colors[1], (val) => val ** 3 * 100);
    this.paint(10, colors[2], (val) => val ** 3 * 100);
    this.paint(15, colors[0], (val) => val ** 3 * 100);
    this.paint(100, colors[1], (val) => val ** 2 * 70, 1 / 50);
    this.paint(110, colors[2], (val) => val ** 2 * 60, 1 / 50);
    shuffle(this.shapes);
  },
  methods: {
    paint(z, color, valueFormula, scaleFactor = 1 / 80) {
      const distribution = simplexDistribution({
        width: 1000,
        height: 1000,
        scaleFactor,
        noise: (x, y) => simplex.noise3D(x, y, z),
      });

      distribution.forEach(({ x, y, value2 }) => {
        this.shapes.push({
          d: randomEquilateral({ x, y }, valueFormula(value2)),
          fill: color,
        });
      });
    },
  },
};
</script>

<style lang="scss">
svg {
  width: 100vw;
  height: 100vh;
}
</style>
