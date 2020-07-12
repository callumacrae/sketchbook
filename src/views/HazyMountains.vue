<template>
  <div class="main">
    <canvas ref="canvas"></canvas>
  </div>
</template>

<script>
import * as PIXI from 'pixi.js';
import * as random from '../utils/random';
import generatePath from '../utils/shapes/wobbly-path';

// random.setSeed('test')

export default {
  mounted() {
    this.init();
  },
  methods: {
    init() {
      const canvas = this.$refs.canvas;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const app = new PIXI.Application({
        width,
        height,
        view: canvas,
        antialias: true,
        resolution: window.devicePixelRatio,
        backgroundColor: 0xffffff
      });

      const generatePeaks = (startY, endY, midPoints, variance) => {
        const points = [[0, startY]];
        for (let i = 0; i < midPoints - 1; i++) {
          const averageY = startY + ((endY - startY) / midPoints) * (i + 1);
          points.push([
            (width / midPoints) * (i + 1),
            averageY + variance * random.value()
          ]);
        }
        points.push([width + 10, endY]);

        const path = generatePath(points, {
          SEGMENT_LENGTH: 10,
          BIAS_TO_PERFECT: 0.5,
          RANDOM_FACTOR: 1
        });

        const flatPath = path.flatMap(x => x);
        flatPath.push(width, height, 0, height);

        const peaks = new PIXI.Graphics();
        peaks.beginFill(random.value() * 0xffffff);
        peaks.drawPolygon(flatPath);
        peaks.endFill();

        app.stage.addChild(peaks);
        return peaks;
      };

      generatePeaks(0.35 * height, 0.35 * height, 7, 45);
      generatePeaks(0.35 * height, 0.35 * height, 11, 35);
      generatePeaks(0.4 * height, 0.35 * height, 11, 35);
      generatePeaks(0.45 * height, 0.4 * height, 10, 40);
      generatePeaks(0.55 * height, 0.6 * height, 8, 50);
      generatePeaks(0.7 * height, 0.55 * height, 6, 90);
      generatePeaks(0.85 * height, 0.85 * height, 12, 30);
    }
  }
};
</script>

<style scoped>
.main {
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;

  background-color: #fafbf8;
}

canvas {
  width: 800px;
  height: 600px;

  box-shadow: 5px 5px 20px 0px rgba(0, 0, 0, 0.1);
}
</style>
