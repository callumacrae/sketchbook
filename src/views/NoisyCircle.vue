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
import SimplexNoise from 'simplex-noise';

import recordMixin from '../mixins/record';

const simplex1 = new SimplexNoise();
const simplex2 = new SimplexNoise();
const simplex3 = new SimplexNoise();

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

      const dpr = window.devicePixelRatio;
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

      const { ctx, width, height } = this;
      const uvFactor = Math.min(width, height)

      ctx.clearRect(0, 0, width, height);

      ctx.lineWidth = 4;
      ctx.strokeStyle = 'black';

      ctx.beginPath();

      const originX = width / 2;
      const originY = height / 2;
      const baseRadius = uvFactor * 0.05;
      const circleRadiusOffset = uvFactor * 0.025;

      for (let circle = 0; circle < 17; circle++) {
        const circleBaseRadius = baseRadius + circle * circleRadiusOffset;
        const points = 5 * (circle + 5);
        // const points = 10;

        for (let angleIndex = 0; angleIndex < points; angleIndex++) {
          const angle = ((Math.PI * 2) / points) * angleIndex;
          // const noise = (simplex, factorIn, factorOut) =>
          //   simplex.noise4D(
          //     Math.sin(angle) * factorIn,
          //     Math.cos(angle) * factorIn,
          //     circle / 17,
          //     timestamp / 7e3
          //   ) * factorOut / 13 * (circle + 0.5);

          // const radius =
          //   circleBaseRadius +
          //   noise(simplex1, 0.5, 100) +
          //   noise(simplex2, 2, 50) +
          //   noise(simplex3, 5, 20);
          const radius = circleBaseRadius;

          const x = originX + radius * Math.sin(angle);
          const y = originY + radius * Math.cos(angle);

          if (angle === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        ctx.closePath();
        ctx.stroke();
      }
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
