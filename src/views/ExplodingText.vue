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

    const blocksX = 12;
    const blocksY = 5;
    const blockWidth = width / 12;
    const blockHeight = height / 5;

    // for (let i = 0; i < blocksX; i++) {
    //   const x = blockWidth * i;
    //   textCtx.beginPath();
    //   textCtx.moveTo(x, 0);
    //   textCtx.lineTo(x, this.height);
    //   textCtx.stroke();
    // }

    // for (let i = 0; i < blocksY; i++) {
    //   const y = blockHeight * i;
    //   textCtx.beginPath();
    //   textCtx.moveTo(0, y);
    //   textCtx.lineTo(this.width, y);
    //   textCtx.stroke();
    // }

    this.mainCtx = this.$refs.mainCanvas.getContext('2d');
    const mainCtx = this.mainCtx;

    this.width = mainCtx.canvas.width;
    this.height = mainCtx.canvas.height;

    for (let i = 0; i < 12; i++) {
      for (let j = 0; j < 5; j++) {
        const x = blockWidth * i;
        const y = blockHeight * j;

        this.blocks.push({ x, y, width: blockWidth, height: blockHeight });
      }
    }

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
