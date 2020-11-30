<template>
  <div>
    <canvas
      ref="canvas"
      @click="status = status === 'playing' ? 'paused' : 'playing'"
    ></canvas>

    <div class="options">
      <h2>Motion:</h2>
      <label>
        <span @click="options.rotation = 0">Rotation:</span>
        <input
          type="range"
          v-model.number="options.rotation"
          min="-0.02"
          max="0.02"
          step="0.001"
        />
      </label>
      <label>
        <span @click="options.x = 0">x:</span>
        <input
          type="range"
          v-model.number="options.x"
          min="-0.05"
          max="0.05"
          step="0.001"
        />
      </label>
      <label>
        <span @click="options.y = 0">y:</span>
        <input
          type="range"
          v-model.number="options.y"
          min="-0.05"
          max="0.05"
          step="0.001"
        />
      </label>
      <small>Click label to set value to 0.</small>
    </div>

    <GlobalEvents target="window" @resize="init" />
  </div>
</template>

<script>
import recordMixin from '../mixins/record';
import { doWorkOffscreen } from '../utils/canvas';

export default {
  mixins: [recordMixin],
  data: () => ({
    status: 'playing',
    width: undefined,
    height: undefined,
    options: {
      rotation: 0.01,
      x: 0,
      y: 0
    },
    gridTransform: {
      rotation: 0.2,
      x: 0,
      y: 0
    }
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
    init() {
      const { width, height } = this;

      const gridWidth = Math.max(width, height);

      this.gridBitmap = doWorkOffscreen(gridWidth, gridWidth, ctx => {
        ctx.lineWidth = 12;

        for (let x = 0; x < width; x += 20) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
      });
    },
    frame(timestamp = 0) {
      this.frameId = requestAnimationFrame(this.frame);

      if (this.status !== 'playing') {
        return;
      }

      const t = timestamp / 1e3;
      const { ctx, width, height, gridBitmap } = this;

      ctx.clearRect(0, 0, width, height);

      const gridWidth = Math.max(width, height);
      ctx.drawImage(gridBitmap, 0, 0, gridWidth, gridWidth);

      ctx.save();

      this.gridTransform.rotation += this.options.rotation;
      this.gridTransform.x += this.options.x;
      this.gridTransform.y += this.options.y;

      const transformX = Math.sin(this.gridTransform.x) * 100;
      const transformY = Math.sin(this.gridTransform.y) * 100;
      ctx.translate(transformX, transformY);

      ctx.translate(width / 2, height / 2);
      ctx.rotate(this.gridTransform.rotation);
      ctx.translate(width / -2, height / -2);

      ctx.drawImage(gridBitmap, 0, 0, gridWidth, gridWidth);

      ctx.restore();
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

.options {
  position: fixed;
  bottom: 15px;
  right: 15px;
  padding: 10px 15px;
  background: rgba(255, 255, 255, 0.85);
}

.options h2 {
  text-align: center;
  font-size: 1em;
  margin-top: 0;
}

.options label {
  display: block;
}

.options input {
  float: right;
  margin-left: 4px;
  vertical-align: middle;
}

.options small {
  display: block;
  margin-top: 4px;
  text-align: center;
}
</style>
