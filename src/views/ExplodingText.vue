<template>
  <div
    class="main"
    @click="status = status === 'playing' ? 'paused' : 'playing'"
  >
    <canvas width="500" height="500" ref="mainCanvas"></canvas>
  </div>
</template>

<script>
import * as random from '../utils/random';
import ease from 'eases/cubic-in-out';

random.setSeed('test');

export default {
  data: () => ({
    status: 'playing',
    frameId: undefined,
    width: undefined,
    height: undefined,
    blocks: []
  }),
  mounted() {
    const textCanvas = new OffscreenCanvas(160, 75);
    this.textCtx = textCanvas.getContext('2d');
    const textCtx = this.textCtx;

    const width = textCtx.canvas.width;
    const height = textCtx.canvas.height;

    textCtx.fillStyle = 'black';
    textCtx.font = '100px sans-serif';
    textCtx.textAlign = 'center';
    textCtx.textBaseline = 'middle';
    textCtx.fillText('test', width / 2, height / 2);

    textCtx.strokeStyle = 'rgba(0, 0, 0, 0.5)';

    const blocksX = 15;
    const blocksY = 7;
    const blockWidth = width / blocksX;
    const blockHeight = height / blocksY;

    const verticalLines = [[0, 0]];
    for (let i = 1; i < blocksX; i++) {
      const topX = blockWidth * i + random.range(-0.5, 0.5) * blockWidth * 0.8;
      const bottomX =
        blockWidth * i + random.range(-0.5, 0.5) * blockWidth * 0.8;
      verticalLines.push([topX, bottomX]);
    }
    verticalLines.push([width, width]);

    const horizontalLines = [[0, 0]];
    for (let i = 1; i < blocksY; i++) {
      const leftY =
        blockHeight * i + random.range(-0.5, 0.5) * blockHeight * 0.8;
      const rightY =
        blockHeight * i + random.range(-0.5, 0.5) * blockHeight * 0.8;
      horizontalLines.push([leftY, rightY]);
    }
    horizontalLines.push([height, height]);

    // Given points (x1, y1) and (x2, y2), returns a and b where y = ax + b
    const solveLine = (x1, y1, x2, y2) => {
      const detA = x1 - x2;
      const a = (y1 - y2) / detA;
      const b = y1 - a * x1;

      return [a, b];
    };

    const findIntersection = (verticalLine, horizontalLine) => {
      const [a, b] = solveLine(verticalLine[0], 0, verticalLine[1], height);
      const [c, d] = solveLine(0, horizontalLine[0], width, horizontalLine[1]);

      if (!isFinite(a)) {
        const x = verticalLine[0];
        const y = c * x + d;
        return [x, y];
      }

      if (!isFinite(c)) {
        return [0, b];
      }

      const x = (d - b) / (a - c);
      const y = a * x + b;
      return [x, y];
    };

    this.blocks = [];
    const maxDelay = verticalLines.length + horizontalLines.length - 4;
    verticalLines.slice(0, -1).forEach((verticalLine, i) => {
      const nextVerticalLine = verticalLines[i + 1];

      horizontalLines.slice(0, -1).forEach((horizontalLine, j) => {
        const nextHorizontalLine = horizontalLines[j + 1];

        const topLeft = findIntersection(verticalLine, horizontalLine);
        const topRight = findIntersection(nextVerticalLine, horizontalLine);
        const bottomLeft = findIntersection(verticalLine, nextHorizontalLine);
        const bottomRight = findIntersection(
          nextVerticalLine,
          nextHorizontalLine
        );

        topLeft[1] -= 0.5;
        topRight[1] -= 0.5;
        bottomLeft[1] += 0.5;
        bottomRight[1] += 0.5;

        let delay = maxDelay - i - j;

        if (delay !== 0) {
          delay += random.range(-0.25, 0.25);
        }

        this.blocks.push({
          coords: [topLeft, topRight, bottomLeft, bottomRight],
          delay,
          translate: [random.range(-40, 40), random.range(100, 120)],
          rotate: random.range(-Math.PI / 2, Math.PI / 2)
        });
      });
    });

    const mainCanvas = this.$refs.mainCanvas;
    this.mainCtx = mainCanvas.getContext('2d');
    const mainCtx = this.mainCtx;

    this.width = mainCtx.canvas.width;
    this.height = mainCtx.canvas.height;

    textCtx.fillStyle = 'black';
    textCtx.font = '100px sans-serif';
    textCtx.textAlign = 'center';
    textCtx.textBaseline = 'middle';

    this.blocks.forEach(({ coords }, i) => {
      const [topLeft, topRight, bottomLeft, bottomRight] = coords;
      textCtx.clearRect(0, 0, this.width, this.height);
      textCtx.save();
      textCtx.beginPath();
      textCtx.moveTo(...topLeft);
      textCtx.lineTo(...topRight);
      textCtx.lineTo(...bottomRight);
      textCtx.lineTo(...bottomLeft);
      textCtx.clip();

      textCtx.fillText('test', width / 2, height / 2);

      this.blocks[i].bitmap = this.textCtx.canvas.transferToImageBitmap();

      textCtx.restore();
    });

    this.frame();
  },
  beforeDestroy() {
    cancelAnimationFrame(this.frameId);
  },
  methods: {
    frame(timestamp) {
      this.frameId = requestAnimationFrame(this.frame);

      if (this.status === 'paused') {
        return;
      }

      this.mainCtx.clearRect(0, 0, this.width, this.height);
      this.mainCtx.save();

      const width = this.textCtx.canvas.width;
      const height = this.textCtx.canvas.height;

      const centerX = (this.width - width) / 2;
      const centerY = (this.height - height) / 2;
      this.mainCtx.translate(centerX, centerY);

      // 0 <= t < 1
      const t = ease(Math.sin(timestamp / 400) / 2 + 0.5);
      // Adjusted t range
      const tRange = 0.6;

      const maxDelay = Math.max(...this.blocks.map(({ delay }) => delay));

      this.blocks.forEach(({ bitmap, coords, delay, rotate, translate }) => {
        const [topLeft] = coords;

        const offset = ((1 - tRange) * delay) / maxDelay;
        // adjustedT can actually be more than 1 but that's okay
        const adjustedT = Math.max(0, t / tRange - offset);

        this.mainCtx.save();
        this.mainCtx.translate(
          topLeft[0] + translate[0] * adjustedT,
          topLeft[1] + translate[1] * adjustedT
        );
        this.mainCtx.rotate(rotate * adjustedT);
        this.mainCtx.translate(-topLeft[0], -topLeft[1]);
        this.mainCtx.drawImage(bitmap, 0, 0, width, height);
        this.mainCtx.restore();
      });

      this.mainCtx.restore();
    }
  }
};
</script>

<style scoped>
.main {
  margin-top: 100px;
}
canvas {
  display: block;
  margin: 25px auto;
  border: 1px #efefef solid;
}
</style>
