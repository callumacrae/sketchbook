<template>
  <div>
    <canvas
      ref="canvas"
      @click="status = status === 'playing' ? 'paused' : 'playing'"
    ></canvas>

    <div class="options">
      <h2>Motion:</h2>

      <table>
        <tr>
          <td>
            <label for="rotation" @click="options.rotation = 0">
              Rotation:
            </label>
          </td>
          <td>
            <input
              id="rotation"
              type="range"
              v-model.number="options.rotation"
              min="-0.02"
              max="0.02"
              step="0.001"
            />
          </td>
        </tr>
        <tr>
          <td>
            <label for="xValue" @click="options.x = 0">
              x:
            </label>
          </td>
          <td>
            <input
              id="xValue"
              type="range"
              v-model.number="options.x"
              min="-0.05"
              max="0.05"
              step="0.001"
            />
          </td>
        </tr>
        <tr>
          <td>
            <label for="yValue" @click="options.y = 0">
              y:
            </label>
          </td>
          <td>
            <input
              id="yValue"
              type="range"
              v-model.number="options.y"
              min="-0.05"
              max="0.05"
              step="0.001"
            />
          </td>
        </tr>
        <tr>
          <td>
            <label for="type">Type:</label>
          </td>
          <td>
            <select v-model="options.grid">
              <option value="lines">Lines</option>
              <option value="grid">Grid</option>
            </select>
          </td>
        </tr>
        <tr>
          <td>
            <label for="lineWidth" @click="options.lineWidth = 8">
              Line width:
            </label>
          </td>
          <td>
            <input
              id="lineWidth"
              type="range"
              v-model.number="options.lineWidth"
              min="0.5"
              max="20"
              step="0.5"
            />
          </td>
        </tr>
      </table>

      <small>Click label to reset value.</small>
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
      y: 0,
      grid: 'lines',
      lineWidth: 8
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
    generateGrid() {
      const { width, height } = this;

      const gridWidth = Math.max(width, height);

      this.gridBitmap = doWorkOffscreen(gridWidth, gridWidth, ctx => {
        ctx.lineWidth = this.options.lineWidth;

        if (['lines', 'grid'].includes(this.options.grid)) {
          for (let x = 0; x < width; x += 20) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
          }
        }

        if (this.options.grid === 'grid') {
          for (let y = 0; y < height; y += 20) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
          }
        }
      });
    },
    init() {
      this.generateGrid();
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
  watch: {
    'options.grid': 'generateGrid',
    'options.lineWidth': 'generateGrid'
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
  border-radius: 3px;
}

.options h2 {
  text-align: center;
  font-size: 1em;
  margin-top: 0;
}

.options input, .options select {
  vertical-align: middle;
  width: 100%;
}

.options small {
  display: block;
  margin-top: 4px;
  text-align: center;
}
</style>
