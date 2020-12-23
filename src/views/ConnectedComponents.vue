<template>
  <div class="wrapper">
    <canvas
      ref="canvas"
      @click="status = status === 'playing' ? 'paused' : 'playing'"
    ></canvas>
    <GlobalEvents target="window" @resize="init" />
  </div>
</template>

<script>
import chroma from 'chroma-js';

import * as random from '../utils/random';
import cclFill from '../utils/patterns/ccl-fill';
import recordMixin from '../mixins/record';

const colorScale = chroma
  .scale(['yellow', 'navy'])
  .mode('lch')
  .correctLightness();

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

      // const dpr = window.devicePixelRatio;
      const dpr = 1;
      this.width = 512 * dpr;
      this.height = 512 * dpr;
      canvas.width = this.width;
      canvas.height = this.height;
    },
    init() {
      const { width, height } = this;

      const r = max => [
        random.range(0, max), // base position
        random.range(2000, 2500), // time factor
        random.range(0, 1000), // time offset
        random.range(50, 150) // position offset factor
      ];

      this.lines = [
        ['x', r(width), r(width)],
        ['x', r(width), r(width)],
        ['x', r(width), r(width)],
        ['y', r(height), r(height)],
        ['y', r(height), r(height)],
        ['y', r(height), r(height)]
      ];
    },
    drawLines(timestamp) {
      const { ctx, width, height, lines } = this;

      for (const line of lines) {
        ctx.beginPath();

        const calcVal = point =>
          point[0] + Math.sin(timestamp / point[1] + point[2]) * point[2];

        if (line[0] === 'x') {
          ctx.moveTo(-10, calcVal(line[1]));
          ctx.lineTo(width + 10, calcVal(line[2]));
        } else {
          ctx.moveTo(calcVal(line[1]), -10);
          ctx.lineTo(calcVal(line[2]), height + 10);
        }

        ctx.stroke();
      }
    },
    frame(timestamp = 0) {
      this.frameId = requestAnimationFrame(this.frame);

      if (this.status !== 'playing') {
        return;
      }

      const { ctx, width, height, lines } = this;

      ctx.clearRect(0, 0, width, height);

      ctx.strokeStyle = 'black';
      ctx.lineWidth = 1;
      this.drawLines(timestamp);

      const newImage = cclFill(ctx, val => {
        const color = colorScale(val).rgba();
        color[3] = 255;
        return color;
      });
      ctx.putImageData(newImage, 0, 0);

      ctx.lineWidth = 1.5;
      this.drawLines(timestamp);
    }
  }
};
</script>

<style scoped>
.wrapper {
  width: 100vw;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
}

canvas {
  width: 512px;
  height: 512px;
}
</style>
