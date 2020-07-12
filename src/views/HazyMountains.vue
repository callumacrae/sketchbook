<template>
  <div class="main">
    <canvas ref="canvas"></canvas>
  </div>
</template>

<script>
import * as PIXI from 'pixi.js';
import * as random from '../utils/random';
import generatePath from '../utils/shapes/wobbly-path';

import fragmentShaderSource from './HazyMountains-fragment.glsl';

export default {
  mounted() {
    this.init();
  },
  methods: {
    init() {
      const canvas = this.$refs.canvas;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const dpr = window.devicePixelRatio;
      const app = new PIXI.Application({
        width,
        height,
        view: canvas,
        antialias: true,
        resolution: dpr,
        backgroundColor: 0xffffff
      });

      const background = new PIXI.Graphics();
      background.beginFill(0xffffff);
      background.drawRect(0, 0, width, height);
      background.endFill();
      background.filters = [
        new PIXI.Filter(null, fragmentShaderSource, {
          uDepth: 0,
          uBackground: true
        })
      ];
      app.stage.addChild(background);

      const generatePeaks = (start, end, depth, midPoints, variance) => {
        const startY = start * height;
        const endY = end * height;
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

        const peaksContainer = new PIXI.Container();

        const peaks = new PIXI.Graphics();
        peaks.drawPolygon(flatPath);
        peaksContainer.addChild(peaks);

        // We need the mask otherwise the filter affects too much
        const mask = new PIXI.Graphics();
        mask.beginFill(0xffffff, 1).drawPolygon(flatPath);
        peaksContainer.mask = mask;

        const filter = new PIXI.Filter(null, fragmentShaderSource, {
          uDepth: depth,
          // uStartY: Math.min(startY, endY)
          // @TODO why is this upside down???????
          uStartY: (height - Math.min(...path.map(point => point[1]))) * dpr,
          uBackground: false
        });
        peaks.filters = [filter];

        app.stage.addChild(peaksContainer);
        return peaksContainer;
      };

      generatePeaks(0.28, 0.27, 0.92, 7, 55);
      generatePeaks(0.27, 0.27, 0.86, 11, 35);
      generatePeaks(0.31, 0.28, 0.64, 11, 35);
      generatePeaks(0.35, 0.41, 0.5, 10, 40);
      generatePeaks(0.45, 0.5, 0.35, 8, 80);
      generatePeaks(0.62, 0.6, 0.15, 6, 90);
      generatePeaks(0.79, 0.9, 0.03, 4, 60);
      generatePeaks(0.85, 0.85, 0, 12, 30);

      const passthroughShaderSource = `
        precision mediump float;

        varying vec2 vTextureCoord;
        uniform sampler2D uSampler;
         
        void main(void) {
          gl_FragColor = texture2D(uSampler, vTextureCoord);
        }
      `;

      // This makes some stuff disappear?!
      const passthroughFilter = new PIXI.Filter(null, passthroughShaderSource);
      // app.stage.filters = [passthroughFilter];
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
