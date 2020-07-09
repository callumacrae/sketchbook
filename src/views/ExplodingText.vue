<template>
  <canvas
    ref="mainCanvas"
    @click="status = status === 'playing' ? 'paused' : 'playing'"
  ></canvas>
</template>

<script>
import * as random from '../utils/random';
import ease from 'eases/cubic-in-out';

export default {
  data: () => ({
    status: 'playing',
    frameId: undefined,
    width: undefined,
    height: undefined
  }),
  mounted() {
    this.mainCtx = this.$el.getContext('2d');
    const mainCtx = this.mainCtx;

    this.width = mainCtx.canvas.clientWidth;
    this.height = mainCtx.canvas.clientHeight;
    mainCtx.canvas.width = this.width;
    mainCtx.canvas.height = this.height;

    this.helloBlocks = this.generateBlocks('hello');

    this.frame();
  },
  beforeDestroy() {
    cancelAnimationFrame(this.frameId);
  },
  methods: {
    frame(timestamp = 0) {
      this.frameId = requestAnimationFrame(this.frame);

      if (this.status === 'paused') {
        return;
      }

      this.mainCtx.clearRect(0, 0, this.width, this.height);
      this.mainCtx.save();

      const {
        blocks,
        blockWidth,
        blockHeight,
        textWidth,
        textHeight
      } = this.helloBlocks;

      const centerX = (this.width - textWidth) / 2;
      const centerY = (this.height - textHeight) / 2;
      this.mainCtx.translate(centerX, centerY);

      // 0 <= t < 1
      const t = ease(Math.cos(timestamp / 400 - Math.PI) / 2 + 0.5);
      // Adjusted t range
      const tRange = 0.6;

      const maxDelay = Math.max(...blocks.map(({ delay }) => delay));

      blocks.forEach(({ bitmap, coords, delay, rotate, translate }) => {
        const [topLeft] = coords;

        const offset = ((1 - tRange) * delay) / maxDelay;
        // adjustedT can actually be more than 1 but that's okay
        const adjustedT = Math.max(0, t / tRange - offset);

        this.mainCtx.save();

        const origin = [
          topLeft[0] + blockWidth / 2,
          topLeft[1] + blockHeight / 2
        ];
        // this.mainCtx.translate(origin[0], origin[1]);
        this.mainCtx.translate(
          topLeft[0] + translate[0] * adjustedT,
          topLeft[1] + translate[1] * adjustedT
        );
        this.mainCtx.rotate(rotate * adjustedT);
        this.mainCtx.translate(-origin[0], -origin[1]);
        this.mainCtx.drawImage(bitmap, 0, 0, textWidth, textHeight);
        this.mainCtx.restore();
      });

      this.mainCtx.restore();
    },
    generateBlocks(text, blocksX = 15, blocksY = 7) {
      const textCanvas = new OffscreenCanvas(300, 75);
      const textCtx = textCanvas.getContext('2d');

      const textWidth = textCtx.canvas.width;
      const textHeight = textCtx.canvas.height;

      const blockWidth = textWidth / blocksX;
      const blockHeight = textHeight / blocksY;

      const verticalLines = [[0, 0]];
      for (let i = 1; i < blocksX; i++) {
        const topX =
          blockWidth * i + random.range(-0.5, 0.5) * blockWidth * 0.8;
        const bottomX =
          blockWidth * i + random.range(-0.5, 0.5) * blockWidth * 0.8;
        verticalLines.push([topX, bottomX]);
      }
      verticalLines.push([textWidth, textWidth]);

      const horizontalLines = [[0, 0]];
      for (let i = 1; i < blocksY; i++) {
        const leftY =
          blockHeight * i + random.range(-0.5, 0.5) * blockHeight * 0.8;
        const rightY =
          blockHeight * i + random.range(-0.5, 0.5) * blockHeight * 0.8;
        horizontalLines.push([leftY, rightY]);
      }
      horizontalLines.push([textHeight, textHeight]);

      // Given points (x1, y1) and (x2, y2), returns a and b where y = ax + b
      const solveLine = (x1, y1, x2, y2) => {
        const detA = x1 - x2;
        const a = (y1 - y2) / detA;
        const b = y1 - a * x1;

        return [a, b];
      };

      const findIntersection = (verticalLine, horizontalLine) => {
        const [a, b] = solveLine(
          verticalLine[0],
          0,
          verticalLine[1],
          textHeight
        );
        const [c, d] = solveLine(
          0,
          horizontalLine[0],
          textWidth,
          horizontalLine[1]
        );

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

      const blocks = [];
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

          blocks.push({
            coords: [topLeft, topRight, bottomLeft, bottomRight],
            delay,
            translate: [random.range(-40, 40), random.range(140, 160) + j * 10],
            rotate: random.range(-Math.PI / 2, Math.PI / 2)
          });
        });
      });

      textCtx.fillStyle = 'black';
      textCtx.font = '100px sans-serif';
      textCtx.textAlign = 'center';
      textCtx.textBaseline = 'middle';

      blocks.forEach(({ coords }, i) => {
        const [topLeft, topRight, bottomLeft, bottomRight] = coords;

        textCtx.clearRect(0, 0, textWidth, textHeight);
        textCtx.save();

        textCtx.beginPath();
        textCtx.moveTo(...topLeft);
        textCtx.lineTo(...topRight);
        textCtx.lineTo(...bottomRight);
        textCtx.lineTo(...bottomLeft);
        textCtx.clip();

        textCtx.fillText('hello', textWidth / 2, textHeight / 2, textWidth);

        blocks[i].bitmap = textCtx.canvas.transferToImageBitmap();

        textCtx.restore();
      });

      return {
        blocks,
        blockWidth,
        blockHeight,
        textWidth,
        textHeight
      };
    }
  }
};
</script>

<style scoped>
canvas {
  display: block;
  width: 100vw;
  height: 100vh;
  border: 1px #efefef solid;
}
</style>
