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
import * as lines from '../utils/lines';
import recordMixin from '../mixins/record';
import SimplexNoise from 'simplex-noise';

const simplexX = new SimplexNoise('a');
const simplexY = new SimplexNoise('b');

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

      const dpr = 1; // window.devicePixelRatio;
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

      const ctx = this.ctx;
      const { width, height } = this;

      ctx.clearRect(0, 0, width, height);

      const cellWidth = 50;
      const cellHeight = 70;

      const xFactor = 400;
      const yFactor = 400;
      const t = timestamp / 2e3;

      const xNoiseFactor = 10;
      const yNoiseFactor = 10;

      ctx.lineWidth = 2;
      ctx.strokeStyle = 'black';

      const horizontalLines = [];

      for (let i = 0; i < width + cellWidth; i += cellWidth) {
        const line = [];

        for (let y = -10; y < height + 10; y += 10) {
          const noiseX =
            simplexX.noise3D(i / xFactor, y / yFactor, t) * xNoiseFactor;
          const x = i + noiseX;

          line.push([x, y]);
        }

        horizontalLines.push(line);
      }

      const verticalLines = [];

      for (let i = 0; i < height + cellHeight; i += cellHeight) {
        const line = [];

        for (let x = -10; x < width + 10; x += 10) {
          const noiseY =
            simplexX.noise3D(x / xFactor, i / yFactor, t) * yNoiseFactor;
          const y = i + noiseY;

          line.push([x, y]);
        }

        verticalLines.push(line);
      }

      const previewLines = lines => {
        for (const line of lines) {
          ctx.beginPath();

          for (let i = 0; i < line.length; i++) {
            const [x, y] = line[i];

            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }

          ctx.stroke();
        }
      };
      previewLines(horizontalLines);
      previewLines(verticalLines);

      horizontalLines.forEach((horizontal) => {
        verticalLines.forEach(vertical => {
          // const possiblePointsHorizontal = horizontal.filter(point => {
          //   const vI = 200;
          //   return Math.abs(point[1] - vI) <= xNoiseFactor;
          // });

          // const possiblePointsVertical = vertical.filter(point => {
          //   const hI = 280;
          //   return Math.abs(point[0] - hI) <= yNoiseFactor;
          // });

          const possiblePointsHorizontal = horizontal;
          const possiblePointsVertical = vertical;

          const within = (val, a, b) => {
            return val >= Math.min(a, b) && val < Math.max(a, b);
          };

          possiblePointsHorizontal.slice(1).forEach((pointAB, i) => {
            const pointAA = possiblePointsHorizontal[i];
            const lineA = [pointAA, pointAB];

            possiblePointsVertical.slice(1).forEach((pointBB, j) => {
              const pointBA = possiblePointsVertical[j];
              const lineB = [pointBA, pointBB];

              const intersection = lines.findIntersection(lineA, lineB);

              const doesIntersect =
                within(intersection[0], pointAA[0], pointAB[0]) &&
                within(intersection[0], pointBA[0], pointBB[0]);

              if (doesIntersect) {
                ctx.fillStyle = 'red';
                ctx.beginPath();
                ctx.arc(intersection[0], intersection[1], 2, 0, Math.PI * 2);
                ctx.fill();
              }
            });
          });
        });
      });
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
