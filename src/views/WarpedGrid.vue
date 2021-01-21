<template>
  <div>
    <canvas
      ref="canvas"
      @click="status = status === 'playing' ? 'paused' : 'playing'"
    ></canvas>
    <GlobalEvents target="window" @resize="init" />
  </div>
</template>

<script>
import * as lines from '../utils/lines';
import recordMixin from '../mixins/record';
import SimplexNoise from 'simplex-noise';

const simplexX = new SimplexNoise('a');
const simplexY = new SimplexNoise('b');

export default {
  mixins: [recordMixin],
  data: () => ({
    status: 'playing',
    width: undefined,
    height: undefined
  }),
  mounted() {
    this.setSize();
    this.init();
    this.frame();
  },
  beforeDestroy() {
    cancelAnimationFrame(this.frameId);
  },
  methods: {
    setSize() {
      const canvas = this.$refs.canvas;
      this.ctx = canvas.getContext('2d');

      const dpr = 1; // window.devicePixelRatio;
      this.width = canvas.clientWidth * dpr;
      this.height = canvas.clientHeight * dpr;
      canvas.width = this.width;
      canvas.height = this.height;
    },
    init() {},
    frame(timestamp = 0) {
      this.frameId = requestAnimationFrame(this.frame);

      if (this.status === 'paused') {
        return;
      }

      const ctx = this.ctx;
      const { width, height } = this;

      ctx.clearRect(0, 0, width, height);

      const cellWidth = 50;
      const cellHeight = 70;

      const xFactor = 400;
      const yFactor = 400;
      const t = timestamp / 2e3;

      const xNoiseFactor = 10;
      const yNoiseFactor = 10;

      ctx.lineWidth = 2;
      ctx.fillStyle = 'black';

      const cellsX = Math.ceil(width / cellWidth);
      const cellsY = Math.ceil(height / cellHeight);

      const warp = ([x, y]) => {
        const xFactor = 400;
        const yFactor = 400;
        const t = timestamp / 1e3;
        const noiseX = simplexX.noise3D(x / xFactor, y / yFactor, t) * 10;
        const noiseY = simplexY.noise3D(x / xFactor, y / yFactor, t) * 10;

        return [x + noiseX, y + noiseY];
      };

      const lineBetween = (a, b) => {
        const divisions = 5;
        const offset = [(b[0] - a[0]) / divisions, (b[1] - a[1]) / divisions];

        for (let i = 0; i <= divisions; i++) {
          ctx.lineTo(...warp([a[0] + offset[0] * i, a[1] + offset[1] * i]));
        }
      };

      for (let i = -1; i <= cellsX; i++) {
        for (let j = -1; j <= cellsY; j++) {
          // Only draw every other rectangle
          if (Math.abs(i % 2) !== Math.abs(j % 2)) {
            continue;
          }

          const startX = i * cellWidth;
          const startY = j * cellHeight;

          ctx.beginPath();
          ctx.moveTo(...warp([startX, startY]));
          lineBetween([startX, startY], [startX + cellWidth, startY]);
          lineBetween(
            [startX + cellWidth, startY],
            [startX + cellWidth, startY + cellHeight]
          );
          lineBetween(
            [startX + cellWidth, startY + cellHeight],
            [startX, startY + cellHeight]
          );
          lineBetween([startX, startY + cellHeight], [startX, startY]);
          ctx.fill();
        }
      }
    }
  },
  computed: {
    uvFactor() {
      return Math.min(this.width, this.height);
    }
  }
};
</script>

<style scoped>
canvas {
  width: 100vw;
  height: 100vh;
}
</style>
