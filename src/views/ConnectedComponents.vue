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
    height: undefined,
    options: {
      antialias: false
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
      ctx.lineWidth = 1;

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
      }

      let linesOnly;
      if (this.options.antialias) {
        linesOnly = document.createElement('canvas');
        linesOnly.width = ctx.canvas.width;
        linesOnly.height = ctx.canvas.height;
        linesOnly.getContext('2d').drawImage(ctx.canvas, 0, 0);
      }

      const imageData = ctx.getImageData(0, 0, width, height);

      // -1: not hole
      // 0: unlabelled
      // 1+: labels
      // maximum value is 32,767 - @todo check this is ok
      const data = new Int16Array(width * height);

      for (let i = 0; i < width * height; i++) {
        data[i] = imageData.data[i * 4 + 3] < 100 ? 0 : -1;
      }

      let nextLabel = 1;
      const equivalent = new Map();

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = y * width + x;

          if (data[i] === -1) {
            continue;
          }

          const leftLabel = x ? data[i - 1] : -1;
          const aboveLabel = y ? data[i - width] : -1;

          if (leftLabel === -1 && aboveLabel === -1) {
            data[i] = nextLabel;
            nextLabel++;
          } else if (leftLabel === -1) {
            data[i] = aboveLabel;
          } else if (aboveLabel === -1) {
            data[i] = leftLabel;
          } else {
            const label = Math.min(aboveLabel, leftLabel);
            data[i] = label;

            if (aboveLabel !== leftLabel) {
              equivalent.set(
                Math.max(aboveLabel, leftLabel),
                equivalent.get(label) || label
              );
            }
          }
        }
      }

      for (let i = 0; i < width * height; i++) {
        if (equivalent.has(data[i])) {
          data[i] = equivalent.get(data[i]);
        }
      }

      const groupSizes = {};
      for (let i = 0; i < width * height; i++) {
        if (!groupSizes[data[i]]) {
          groupSizes[data[i]] = 0;
        }

        groupSizes[data[i]]++;
      }

      const groupSizesFlat = Object.entries(groupSizes)
        .filter(([label]) => label !== -1)
        .map(([key, value]) => value);

      const maxGroupSize = Math.max(...groupSizesFlat);

      const groupColors = {
        '-1': [0, 0, 0, this.options.antialias ? 0 : 255]
      };
      for (let [label, value] of Object.entries(groupSizes)) {
        if (label === '-1') {
          continue;
        }

        const color = colorScale(value / maxGroupSize).rgba();
        color[3] = 255;

        groupColors[label] = color;
      }

      const newImageData = new Uint8ClampedArray(width * height * 4);

      for (let i = 0; i < data.length; i++) {
        const label = data[i];

        const color = groupColors[label];

        newImageData[i * 4] = color[0];
        newImageData[i * 4 + 1] = color[1];
        newImageData[i * 4 + 2] = color[2];
        newImageData[i * 4 + 3] = color[3];
      }

      const newImage = new ImageData(newImageData, width, height);
      ctx.putImageData(newImage, 0, 0);

      if (this.options.antialias) {
        ctx.drawImage(linesOnly, 0, 0);
      }

      // convert imageData to holeData
      // first pass CCL
      // second pass CCL
      // calculate what to draw
      // putImageData
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
