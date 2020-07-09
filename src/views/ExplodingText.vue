<template>
  <div
    class="main"
    @click="status = status === 'playing' ? 'paused' : 'playing'"
  >
    <canvas width="160" height="75" ref="textCanvas"></canvas>
    <canvas width="500" height="500" ref="mainCanvas"></canvas>
  </div>
</template>

<script>
export default {
  data: () => ({
    status: 'playing',
    frameId: undefined,
    width: undefined,
    height: undefined,
    blocks: []
  }),
  mounted() {
    this.textCtx = this.$refs.textCanvas.getContext('2d');

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
      const topX = blockWidth * i + (Math.random() - 0.5) * blockWidth * 0.8;
      const bottomX = blockWidth * i + (Math.random() - 0.5) * blockWidth * 0.8;
      verticalLines.push([topX, bottomX]);
    }
    verticalLines.push([width, width]);

    const horizontalLines = [[0, 0]];
    for (let i = 1; i < blocksY; i++) {
      const leftY = blockHeight * i + (Math.random() - 0.5) * blockHeight * 0.8;
      const rightY =
        blockHeight * i + (Math.random() - 0.5) * blockHeight * 0.8;
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
    verticalLines.slice(0, -1).forEach((verticalLine, i) => {
      const nextVerticalLine = verticalLines[i + 1];

      horizontalLines.slice(0, -1).forEach((horizontalLine, i) => {
        const nextHorizontalLine = horizontalLines[i + 1];

        const topLeft = findIntersection(verticalLine, horizontalLine);
        const topRight = findIntersection(nextVerticalLine, horizontalLine);
        const bottomLeft = findIntersection(verticalLine, nextHorizontalLine);
        const bottomRight = findIntersection(
          nextVerticalLine,
          nextHorizontalLine
        );

        this.blocks.push([topLeft, topRight, bottomLeft, bottomRight]);
      });
    });

    const DEBUG_BLOCKS = false;
    if (DEBUG_BLOCKS) {
      this.blocks.forEach(([topLeft, topRight, bottomLeft, bottomRight]) => {
        textCtx.beginPath();
        textCtx.moveTo(...topLeft);
        textCtx.lineTo(...topRight);
        textCtx.lineTo(...bottomRight);
        textCtx.lineTo(...bottomLeft);
        const randomHue = Math.floor(Math.random() * 256);
        textCtx.fillStyle = `hsla(${randomHue}, 80%, 50%, 0.2)`;
        textCtx.fill();
      });
      return;
    }

    this.mainCtx = this.$refs.mainCanvas.getContext('2d');
    const mainCtx = this.mainCtx;

    this.width = mainCtx.canvas.width;
    this.height = mainCtx.canvas.height;

    const DEBUG_EXPLODE = true;
    if (DEBUG_EXPLODE) {
      textCtx.fillStyle = 'black';
      textCtx.font = '100px sans-serif';
      textCtx.textAlign = 'center';
      textCtx.textBaseline = 'middle';

      this.blocks.forEach(([topLeft, topRight, bottomLeft, bottomRight]) => {
        textCtx.clearRect(0, 0, this.width, this.height);
        textCtx.save();
        textCtx.beginPath();
        textCtx.moveTo(...topLeft);
        textCtx.lineTo(...topRight);
        textCtx.lineTo(...bottomRight);
        textCtx.lineTo(...bottomLeft);
        textCtx.clip();

        textCtx.fillText('test', width / 2, height / 2);

        this.mainCtx.drawImage(
          this.textCtx.canvas,
          topLeft[0],
          topLeft[1],
          width,
          height
        );

        textCtx.restore();
      });
      return;
    }

    // this.frame();
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

      const t = timestamp / 750;
      const offset = Math.sin(t) + 2;

      this.blocks.forEach(block => {
        this.mainCtx.drawImage(
          this.textCtx.canvas,
          block.x,
          block.y,
          block.width,
          block.height,
          block.x * offset,
          block.y * offset,
          block.width,
          block.height
        );
      });
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
