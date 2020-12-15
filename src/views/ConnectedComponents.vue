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
import * as random from '../utils/random';
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
    frame(timestamp = 0) {
      this.frameId = requestAnimationFrame(this.frame);

      if (this.status !== 'playing') {
        return;
      }

      const t = timestamp / 1e3;
      const ctx = this.ctx;
      const { width, height, lines, uvFactor } = this;

      ctx.clearRect(0, 0, width, height);

      ctx.strokeStyle = 'black';
      ctx.lineWidth = 10;

      for (const line of this.lines) {
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

        const imageData = ctx.getImageData(0, 0, width, height).data;
        if (Math.random() < 0.01) {
          console.log(imageData);
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
