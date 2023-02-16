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
      distFactSmallA: 500,
      distFactSmallB: 50,
      distFactBigA: 300,
      distFactBigB: 500,
      smallBigMix: 0.4,
      distFactThreshold: 0.25,
      lines: 200,
      lineWidth: 2,
      segmentY: 5,
      noiseXIn: 700,
      noiseYIn: 700,
      noiseOut: 90,
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
    gui.add(this.config, 'distFactSmallA', 50, 1000, 1);
    gui.add(this.config, 'distFactSmallB', 5, 1000, 1);
    gui.add(this.config, 'distFactBigA', 50, 1000, 1);
    gui.add(this.config, 'distFactBigB', 5, 1000, 1);
    gui.add(this.config, 'smallBigMix', 0, 1);
    gui.add(this.config, 'distFactThreshold', 0, 1);
    gui.add(this.config, 'lines', 1, 500, 1);
    gui.add(this.config, 'lineWidth', 1, 10);
    gui.add(this.config, 'segmentY', 1, 100, 1);
    gui.add(this.config, 'noiseXIn', 1, 5000, 1);
    gui.add(this.config, 'noiseYIn', 1, 5000, 1);
    gui.add(this.config, 'noiseOut', 1, 500, 1);

    this.stats = new Stats();
    this.stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
    document.body.appendChild(this.stats.dom);
  },
  beforeUnmount() {
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

      const transform = ([x, y]) => {
        const offsetX =
          simplex.noise2D(x / config.noiseXIn, y / config.noiseYIn) *
          config.noiseOut;
        return [x + offsetX, y];
      };

      const samplePoint = (point, untransformedPoint) => {
        const distFromOrigin = Vector.between(origin, point).getMagnitude();

        let pointValue = distFromOrigin < maxDist;

        // Random missing bits inside circle
        {
          const noise = simplex.noise2D(point[0] / 50, point[1] / 50);
          if (noise < -0.9) {
            pointValue = false;
          }
        }

        // Edge fuzzing
        {
          const distFromCircleEdge = Math.abs(distFromOrigin - maxDist);
          const distFactorForSmall = Math.max(0, 1 - distFromCircleEdge / config.distFactSmallA);
          const noiseForSmall =
            simplex.noise2D(untransformedPoint[0], point[1] / config.distFactSmallB) *
            distFactorForSmall;
          const distFactorForBig = Math.max(0, 1 - distFromCircleEdge / config.distFactBigA);
          const noiseForBig =
            simplex.noise2D(untransformedPoint[0], point[1] / config.distFactBigB) *
            distFactorForBig;

          const mix = (a, b, factor = config.smallBigMix) => a * factor + b * (1 - factor);

          if (mix(noiseForSmall, noiseForBig) < -1 * config.distFactThreshold) {
            pointValue = true;
          } else if (mix(noiseForSmall, noiseForBig) > config.distFactThreshold) {
            pointValue = false;
          }
        }

        return pointValue;
      };

      ctx.lineWidth = config.lineWidth;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'black';
      for (let i = 0; i < config.lines; i++) {
        const x = (width / config.lines) * i;
        let lastSegmentDrawn = false;
        let lastPoint = transform([x, 0]);

        ctx.beginPath();
        ctx.moveTo(...lastPoint);

        for (let y = 0; y < height; y += config.segmentY) {
          const untransformedPoint = [x, y + config.segmentY];
          const nextPoint = transform(untransformedPoint);

          const centerPoint = [(lastPoint[0] + nextPoint[0]) / 2, y];

          if (samplePoint(centerPoint, untransformedPoint)) {
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
