<template>
  <div>
    <canvas
      ref="canvas"
      @click="status = status === 'playing' ? 'paused' : 'playing'"
    ></canvas>
    <GlobalEvents target="window" @resize="setSize" />
  </div>
</template>

<script>
import * as dat from 'dat.gui';
import Stats from 'stats.js';
import SimplexNoise from 'simplex-noise';

import recordMixin from '../mixins/record';
import Vector from '../utils/vector';

const simplex = new SimplexNoise('seed');

export default {
  mixins: [recordMixin],
  data: () => ({
    status: 'playing',
    width: undefined,
    height: undefined,
    config: {
      circleRadius: 0.4,
      lines: 150,
      lineWidth: 2,
      segmentY: 5,
      noiseXIn: 850,
      noiseYIn: 850,
      noiseOut: 100,
    },
  }),
  mounted() {
    this.setSize();
    this.init().then(() => {
      this.frame();

      if (false) {
        this.record({
          width: 1000,
          height: 1000,
          fps: 25,
          duration: 10e3,
          directory: '',
          background: 'black',
        });
      }
    });

    const gui = new dat.GUI();
    this.gui = gui;

    if (window.frameElement) {
      gui.close();
    }

    gui.add(this.config, 'circleRadius', 0.1, 0.9);
    gui.add(this.config, 'lines', 1, 200, 1);
    gui.add(this.config, 'lineWidth', 1, 20, 1);
    gui.add(this.config, 'segmentY', 1, 100, 1);
    gui.add(this.config, 'noiseXIn', 1, 10000, 1);
    gui.add(this.config, 'noiseYIn', 1, 10000, 1);
    gui.add(this.config, 'noiseOut', 1, 1000, 1);

    this.stats = new Stats();
    this.stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
    document.body.appendChild(this.stats.dom);
  },
  beforeDestroy() {
    cancelAnimationFrame(this.frameId);

    if (this.gui) {
      this.gui.destroy();
    }
    if (this.stats) {
      this.stats.dom.remove();
      delete this.stats;
    }
  },
  methods: {
    setSize() {
      const canvas = this.$refs.canvas;
      this.ctx = canvas.getContext('2d');

      const dpr = window.devicePixelRatio;
      this.width = canvas.clientWidth * dpr;
      this.height = canvas.clientHeight * dpr;
      canvas.width = this.width;
      canvas.height = this.height;
    },
    init() {
      return Promise.resolve();
    },
    frame(timestamp = 0) {
      if (this.status !== 'recording') {
        // this.frameId = requestAnimationFrame(this.frame);
      }

      if (this.status === 'paused') {
        return;
      }

      this.stats.begin();

      const t = timestamp / 1e3;
      const { width, height, ctx, config } = this;

      ctx.clearRect(0, 0, width, height);

      const origin = [width / 2, height / 2];
      const maxDist = Math.min(width, height) * config.circleRadius;

      const transform = (x, y) => {
        const offsetX =
          simplex.noise2D(x / config.noiseXIn, y / config.noiseYIn) *
          config.noiseOut;
        return [x + offsetX, y];
      };

      ctx.lineWidth = config.lineWidth;
      ctx.lineCap = "round"
      ctx.strokeStyle = 'black';
      for (let i = 0; i < config.lines; i++) {
        const x = (width / config.lines) * i;
        let lastSegmentDrawn = false;
        let lastPoint = transform(x, 0);

        ctx.beginPath();
        ctx.moveTo(...lastPoint);

        for (let y = 0; y < height; y += config.segmentY) {
          const nextPoint = transform(x, y + config.segmentY);

          const centerPoint = [(lastPoint[0] + nextPoint[0]) / 2, y];

          const distFromOrigin = Vector.between(
            origin,
            centerPoint
          ).getMagnitude();

          if (distFromOrigin < maxDist) {
            ctx.lineTo(...nextPoint);
          } else {
            ctx.moveTo(...nextPoint);
          }

          lastPoint = nextPoint;
        }

        ctx.stroke();
      }

      this.stats.end();
    },
  },
  watch: {
    config: {
      deep: true,
      handler: 'frame',
    },
  },
};
</script>

<style scoped>
canvas {
  width: 100vw;
  height: 100vh;
}
</style>
