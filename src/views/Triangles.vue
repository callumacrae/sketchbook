<template>
  <div class="triangles">
    <canvas
      ref="canvas"
      width="600"
      height="600"
      style="position: absolute"
    ></canvas>
    <svg style="position: absolute">
      <rect
        v-for="(pixel, i) in highlightPixels"
        :width="2"
        :height="2"
        :x="pixel[0]"
        :y="pixel[1]"
        fill="green"
        :key="`highlight-${i}`"
      />

      <path v-for="(shape, i) in shapes" v-bind="shape" :key="`shape-${i}`" />
    </svg>
  </div>
</template>

<script>
import Vue from 'vue';
import SimplexNoise from 'simplex-noise';
import simplexDistribution from '../utils/distributions/simplex.ts';
import { shuffle } from '../utils/maths.ts';
import { rand4 } from '../utils/colors.ts';
import { randomEquilateral } from '../utils/shapes/triangles';

const colors = rand4();
const backgroundColor = colors.splice(Math.floor(Math.random() * 3), 1);
document.body.style.backgroundColor = backgroundColor;

const simplex = new SimplexNoise();

export default Vue.extend({
  data: () => ({
    shapes: [],
    highlightPixels: [],
    z: 0
  }),
  mounted() {
    this.paint(0, colors[0], val => val ** 3 * 100);
    this.paint(0.5, colors[1], val => val ** 3 * 100);
    this.paint(10, colors[2], val => val ** 3 * 100);
    this.paint(15, colors[0], val => val ** 3 * 100);
    this.paint(100, colors[1], val => val ** 2 * 70, 1 / 50);
    this.paint(110, colors[2], val => val ** 2 * 60, 1 / 50);
    shuffle(this.shapes);
  },
  methods: {
    paint(z, color, valueFormula, scaleFactor = 1 / 80) {
      const distribution = simplexDistribution({
        width: 1000,
        height: 1000,
        scaleFactor,
        noise: (x, y) => simplex.noise3D(x, y, z)
      });

      distribution.forEach(({ x, y, value2 }) => {
        this.shapes.push({
          d: randomEquilateral({ x, y }, valueFormula(value2)),
          fill: color
        });
      });
    }
  }
});
</script>

<style lang="scss">
.triangles {
  height: 100vh;
  // background-color: #2c003e;
}

svg {
  width: 100%;
  height: 100%;

  rect {
    opacity: 0.5;
  }
}
</style>
