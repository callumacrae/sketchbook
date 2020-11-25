<template>
  <div>
    <canvas
      ref="canvas"
      @click="status = status === 'playing' ? 'paused' : 'playing'"
      @mousemove="handleMousemove"
    ></canvas>
    <GlobalEvents target="window" @resize="init" />
  </div>
</template>

<script>
import recordMixin from '../mixins/record';

export default {
  mixins: [recordMixin],
  data: () => ({
    status: 'playing',
    windowWidth: undefined,
    windowHeight: undefined,
    width: undefined,
    height: undefined,
    mousePosition: { x: undefined, y: undefined }
  }),
  mounted() {
    this.setSize();
    this.init();
    this.frame();

    if (false) {
      this.record({
        width: 1200,
        height: 675,
        fps: 50,
        duration: 1e3,
        directory: 'perspective-lines'
      });
    }
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
    init() {
      this.windowWidth = window.innerWidth;
      this.windowHeight = window.innerHeight;
    },
    frame(timestamp = 0) {
      if (this.status !== 'recording') {
        this.frameId = requestAnimationFrame(this.frame);
      }

      if (this.status === 'paused') {
        return;
      }

      const t = (timestamp / 1e3) % 1;
      const ctx = this.ctx;
      const {
        width,
        height,
        lines,
        uvFactor,
        mousePosition,
        windowWidth,
        windowHeight
      } = this;

      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, width, height);

      let xOffset = 0;
      let y = 0.5;

      if (status === 'recording') {
        mousePosition.x = undefined;
        mousePosition.y = undefined;
      }

      const mouseU =
        mousePosition.x === undefined ? 0.5 : mousePosition.x / windowWidth;
      xOffset = (0.5 - mouseU) * 0.3 + ((t * -0.1) % 1);

      const mouseV =
        mousePosition.y === undefined ? 0.5 : mousePosition.y / windowHeight;
      y = 0.5 + (0.5 - mouseV) * 0.3;

      for (let z = 15; z >= 0; z--) {
        for (let x = -3; x <= 5; x += 0.1) {
          this.drawLine(x + xOffset, y, z * 0.2);
        }
      }
    },
    drawLine(x, y, z) {
      const { ctx, width: canvasWidth, height: canvasHeight, uvFactor } = this;

      const perspectiveFactor = 1 / (1 + z);

      const height = (uvFactor / 2) * perspectiveFactor;
      const realX = canvasWidth / 2 + (x - 0.5) * uvFactor * perspectiveFactor;
      const realYOrigin =
        canvasHeight / 2 + (y - 0.5) * uvFactor * perspectiveFactor;

      if (realX < 0 || realX > canvasWidth) {
        return;
      }

      ctx.lineWidth = 10 * perspectiveFactor;
      ctx.lineCap = 'round';
      const c = 255 * perspectiveFactor ** 2.5;
      ctx.strokeStyle = `rgb(${c}, ${c}, ${c})`;
      ctx.beginPath();
      ctx.moveTo(realX, realYOrigin - height / 2);
      ctx.lineTo(realX, realYOrigin + height / 2);
      ctx.stroke();
    },
    handleMousemove(e) {
      this.mousePosition = {
        x: e.clientX,
        y: e.clientY
      };
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
