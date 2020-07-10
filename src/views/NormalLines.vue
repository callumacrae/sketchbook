<template>
  <canvas></canvas>
</template>

<script>
import Vector from '../utils/vector';
import generatePath from '../utils/shapes/wobbly-path';
import * as random from '../utils/random';
import wobblyPath from '../utils/shapes/wobbly-path';

export default {
  mounted() {
    const opacity = 0.6;
    const config = {
      NUMBER_OF_LINES: 1000,
      startLength: () => 150 + random.value() * 300,
      endLength: () => 500 + random.value() * 100,
      BACKGROUND_COLOR: '#262819',
      // https://color.adobe.com/Passado1-color-theme-8032401/
      COLORS: [
        `rgba(83, 84, 115, ${opacity})`, // blue
        `rgba(214, 216, 209, ${opacity})`, // white
        `rgba(159, 145, 124, ${opacity})`, // cream
        `rgba(142, 55, 48, ${opacity})` // red
      ],
      LINE_WIDTH: 6,
      PATH: {
        SEGMENT_LENGTH: 10,
        BIAS_TO_PERFECT: 0.5,
        RANDOM_FACTOR: 1
      }
    };

    const canvas = this.$el;
    const ctx = canvas.getContext('2d');
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width;
    canvas.height = height;

    const origin = [width / 2, height / 2];

    ctx.fillStyle = config.BACKGROUND_COLOR;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(origin[0], origin[1]);

    for (let i = 0; i < config.NUMBER_OF_LINES; i++) {
      let randomDirection = Vector.random();
      const start = randomDirection
        .restrictMagnitude(config.startLength())
        .toArray();
      const end = randomDirection
        .restrictMagnitude(config.endLength())
        .toArray();

      ctx.lineWidth = config.LINE_WIDTH;
      ctx.strokeStyle = random.pick(config.COLORS);

      const path = generatePath(start, end, config.PATH);

      ctx.beginPath();
      path.forEach((point, i) => {
        if (i === 0) {
          ctx.moveTo(...point);
        } else {
          ctx.lineTo(...point);
        }
      });
      ctx.stroke();
    }

    ctx.restore();
  }
};
</script>

<style scoped>
canvas {
  width: 100vw;
  height: 100vh;
}
</style>
