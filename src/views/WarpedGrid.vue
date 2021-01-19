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
import recordMixin from '../mixins/record';

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

      const t = timestamp / 1e3;
      const ctx = this.ctx;
      const { width, height, lines, uvFactor } = this;

      ctx.clearRect(0, 0, width, height);

      const cellWidth = 50;
      const cellHeight = 70;

      const pixels = new Uint8ClampedArray(width * height * 4);

      for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
          const cellOddX = Math.floor(x / cellWidth) % 2 === 0;
          const cellOddY = Math.floor(y / cellHeight) % 2 === 0;

          const startIndex = (y * width + x) * 4;

          if (cellOddX === cellOddY) {
            pixels[startIndex] = 0;
            pixels[startIndex + 1] = 0;
            pixels[startIndex + 2] = 0;
            pixels[startIndex + 3] = 255;
          } else {
            pixels[startIndex] = 255;
            pixels[startIndex + 1] = 255;
            pixels[startIndex + 2] = 255;
            pixels[startIndex + 3] = 255;
          }
        }
      }

      const imageData = new ImageData(pixels, width, height);
      ctx.putImageData(imageData, 0, 0);
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
