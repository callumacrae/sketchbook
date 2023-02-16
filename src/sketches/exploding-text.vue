<template>
  <p v-if="status === 'unsupported'">
    The browser you're in doesn't support OffscreenCanvas yet, so this won't
    work - sorry! Try
    <a href="https://caniuse.com/#search=offscreencanvas">Chrome or Edge</a>.
  </p>
  <canvas
    v-else
    ref="mainCanvas"
    @click="status = status === 'playing' ? 'paused' : 'playing'"
  ></canvas>
</template>

<script>
import * as random from '../utils/random';
import eases from 'eases';
import BezierEasing from 'bezier-easing';

export const meta = {
  name: 'Exploding text',
  date: '2022-07-08',
  favourite: true,
  link: 'https://codepen.io/callumacrae/full/GRodzvO',
};

const rotationEasing = BezierEasing(0.9, 0.25, 0.1, 0.75);

export default {
  data: () => ({
    status: typeof OffscreenCanvas === 'undefined' ? 'unsupported' : 'playing',
    frameId: undefined,
    width: undefined,
    height: undefined,
  }),
  mounted() {
    const canvas = this.$el;
    this.ctx = canvas.getContext('2d');

    this.width = canvas.clientWidth;
    this.height = canvas.clientHeight;
    canvas.width = this.width;
    canvas.height = this.height;

    this.helloTiles = this.generateTiles('hello');
    this.worldTiles = this.generateTiles('world', (textCtx) => {
      textCtx.fillStyle = 'white';
    });

    this.frame();
  },
  beforeUnmount() {
    cancelAnimationFrame(this.frameId);
  },
  methods: {
    frame(timestamp = 0) {
      this.frameId = requestAnimationFrame(this.frame);

      if (this.status === 'paused') {
        return;
      }

      const ctx = this.ctx;
      const t = timestamp / 400;

      ctx.clearRect(0, 0, this.width, this.height);
      ctx.save();

      let rotationT = t % (Math.PI * 2);
      const extra = rotationT > Math.PI ? Math.PI : 0;
      rotationT =
        rotationEasing((rotationT - extra) / Math.PI) * Math.PI + extra;

      ctx.translate(this.width / 2, this.height / 2);
      ctx.rotate(rotationT);
      ctx.translate(-this.width / 2, -this.height / 2);

      ctx.fillStyle = 'black';
      ctx.fillRect(
        this.width / -2,
        this.height / 2,
        this.width * 2,
        this.height
      );

      const helloT = eases.cubicInOut(Math.cos(t - Math.PI) / 2 + 0.5);
      this.drawTiles(this.helloTiles, helloT);

      ctx.save();
      ctx.translate(this.width / 2, this.height / 2);
      ctx.rotate(Math.PI);
      ctx.translate(this.width / -2, this.height / -2);
      const worldT = eases.cubicInOut(Math.cos(t) / 2 + 0.5);
      this.drawTiles(this.worldTiles, worldT);
      ctx.restore();

      ctx.restore();
    },
    generateTiles(text, styleFn, tilesX = 15, tilesY = 7) {
      const textCanvas = new OffscreenCanvas(300, 75);
      const textCtx = textCanvas.getContext('2d');

      const textWidth = textCtx.canvas.width;
      const textHeight = textCtx.canvas.height;

      const tileWidth = textWidth / tilesX;
      const tileHeight = textHeight / tilesY;

      const verticalLines = [[0, 0]];
      for (let i = 1; i < tilesX; i++) {
        const topX = tileWidth * i + random.range(-0.5, 0.5) * tileWidth * 0.8;
        const bottomX =
          tileWidth * i + random.range(-0.5, 0.5) * tileWidth * 0.8;
        verticalLines.push([topX, bottomX]);
      }
      verticalLines.push([textWidth, textWidth]);

      const horizontalLines = [[0, 0]];
      for (let i = 1; i < tilesY; i++) {
        const leftY =
          tileHeight * i + random.range(-0.5, 0.5) * tileHeight * 0.8;
        const rightY =
          tileHeight * i + random.range(-0.5, 0.5) * tileHeight * 0.8;
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

      const tiles = [];
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

          // This is to make the tile overlap slightly, fixing a strange issue
          topLeft[0] -= 0.5;
          topLeft[1] -= 0.5;
          topRight[0] += 0.5;
          topRight[1] -= 0.5;
          bottomLeft[0] -= 0.5;
          bottomLeft[1] += 0.5;
          bottomRight[0] += 0.5;
          bottomRight[1] += 0.5;

          let delay = maxDelay - i - j;

          if (delay !== 0) {
            delay += random.range(-0.25, 0.25);
          }

          tiles.push({
            coords: [topLeft, topRight, bottomLeft, bottomRight],
            delay,
            translate: [random.range(-40, 40), random.range(140, 160) + j * 10],
            rotate: random.range(-Math.PI / 2, Math.PI / 2),
          });
        });
      });

      textCtx.fillStyle = 'black';
      textCtx.font = '100px sans-serif';
      textCtx.textAlign = 'center';
      textCtx.textBaseline = 'middle';

      if (typeof styleFn === 'function') {
        styleFn(textCtx);
      }

      tiles.forEach(({ coords }, i) => {
        const [topLeft, topRight, bottomLeft, bottomRight] = coords;

        textCtx.clearRect(0, 0, textWidth, textHeight);
        textCtx.save();

        textCtx.beginPath();
        textCtx.moveTo(...topLeft);
        textCtx.lineTo(...topRight);
        textCtx.lineTo(...bottomRight);
        textCtx.lineTo(...bottomLeft);
        textCtx.clip();

        textCtx.fillText(text, textWidth / 2, textHeight / 2, textWidth);

        tiles[i].bitmap = textCtx.canvas.transferToImageBitmap();

        textCtx.restore();
      });

      return {
        tiles,
        tileWidth,
        tileHeight,
        textWidth,
        textHeight,
      };
    },
    drawTiles(tilesObj, t) {
      const { tiles, tileWidth, tileHeight, textWidth, textHeight } = tilesObj;
      const ctx = this.ctx;

      ctx.save();

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(this.width, 0);
      ctx.lineTo(this.width, this.height / 2);
      ctx.lineTo(0, this.height / 2);
      ctx.clip();

      const offsetY = 250;
      const centerX = (this.width - textWidth) / 2;
      const centerY = (this.height - textHeight - offsetY) / 2;
      ctx.translate(centerX, centerY);

      // 0 <= t < 1
      // Adjusted t range
      const tRange = 0.6;

      const maxDelay = Math.max(...tiles.map(({ delay }) => delay));

      tiles.forEach(({ bitmap, coords, delay, rotate, translate }) => {
        const [topLeft] = coords;

        const offset = ((1 - tRange) * delay) / maxDelay;
        // adjustedT can actually be more than 1 but that's okay
        const adjustedT = Math.max(0, t / tRange - offset);

        ctx.save();

        const origin = [
          topLeft[0] + tileWidth / 2,
          topLeft[1] + tileHeight / 2,
        ];
        // ctx.translate(origin[0], origin[1]);
        ctx.translate(
          topLeft[0] + translate[0] * adjustedT,
          topLeft[1] + translate[1] * adjustedT
        );
        ctx.rotate(rotate * adjustedT);
        ctx.translate(-origin[0], -origin[1]);
        ctx.drawImage(bitmap, 0, 0, textWidth, textHeight);
        ctx.restore();
      });

      ctx.restore();
    },
  },
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
