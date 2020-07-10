<template>
  <canvas
    @click="status = status === 'playing' ? 'paused' : 'playing'"
  ></canvas>
</template>

<script>
import Vector from '../utils/vector';
import generatePath from '../utils/shapes/wobbly-path';
import * as random from '../utils/random';
import wobblyPath from '../utils/shapes/wobbly-path';
import { doWorkOffscreen } from '../utils/canvas';

const isMobile = window.innerWidth < 500;

const opacity = 0.6;
const config = {
  NUMBER_OF_LINES: isMobile ? 1000 : 2000,
  GROUP_BY: 50,
  startLength: () => random.range(0.12, 0.35),
  endLength: () => random.range(0.39, 0.47),
  BACKGROUND_COLOR: '#262819',
  // https://color.adobe.com/Passado1-color-theme-8032401/
  COLORS: [
    `rgb(83, 84, 115, ${opacity})`, // blue
    `rgba(214, 216, 209, ${opacity})`, // white
    `rgba(159, 145, 124, ${opacity})`, // cream
    `rgba(142, 55, 48, ${opacity})` // red
  ],
  LINE_WIDTH: isMobile ? 0.004 : 0.002,
  PATH: {
    SEGMENT_LENGTH: 10,
    BIAS_TO_PERFECT: 0.5,
    RANDOM_FACTOR: 1
  }
};

export default {
  data: () => ({
    status: 'playing',
    width: undefined,
    height: undefined,
    lines: [],
    bitmaps: [],
    frameId: undefined
  }),
  mounted() {
    const canvas = this.$el;
    const ctx = canvas.getContext('2d');
    this.ctx = ctx;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const uvFactor = Math.min(width, height);
    canvas.width = width;
    canvas.height = height;
    this.width = width;
    this.height = height;

    this.lines = [];
    for (let i = 0; i < config.NUMBER_OF_LINES; i++) {
      let randomDirection = Vector.random();
      const start = randomDirection
        .restrictMagnitude(config.startLength() * uvFactor)
        .toArray();
      const end = randomDirection
        .restrictMagnitude(config.endLength() * uvFactor)
        .toArray();

      this.lines.push({
        path: generatePath(start, end, config.PATH),
        color: random.pick(config.COLORS)
      });
    }

    const origin = [width / 2, height / 2];

    // We have to predraw the lines in groups or it's like 15fps
    for (let i = 0; i < this.lines.length; i += config.GROUP_BY) {
      const linesGroup = this.lines.slice(i, i + config.GROUP_BY);

      const bitmap = doWorkOffscreen(width, height, ctx => {
        ctx.translate(origin[0], origin[1]);

        ctx.lineWidth = config.LINE_WIDTH * uvFactor;

        linesGroup.forEach(({ path, color }) => {
          ctx.beginPath();
          ctx.moveTo(path[0][0], path[0][1]);
          path.slice(1).forEach(point => {
            ctx.lineTo(point[0], point[1]);
          });
          ctx.strokeStyle = color;
          ctx.stroke();
        });
      });

      this.bitmaps.push(bitmap);
    }

    this.frame();
  },
  beforeDestroy() {
    cancelAnimationFrame(this.frameId);
  },
  methods: {
    frame(timestamp = 0) {
      this.frameId = requestAnimationFrame(this.frame);

      if (this.status !== 'playing') {
        return;
      }

      const t = timestamp / 12e3;

      const ctx = this.ctx;
      const { width, height, lines } = this;
      const uvFactor = Math.min(width, height);

      const origin = [width / 2, height / 2];

      ctx.fillStyle = config.BACKGROUND_COLOR;
      ctx.fillRect(0, 0, width, height);

      this.bitmaps.forEach((bitmap, i) => {
        const adjustedT = (t + i / this.bitmaps.length) % 1;
        const alpha = adjustedT < 0.9 ? 1 : Math.abs(0.95 - adjustedT) * 20;
        ctx.globalAlpha = alpha;
        ctx.drawImage(bitmap, 0, 0, width, height);
      });

      ctx.globalAlpha = 1;
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
