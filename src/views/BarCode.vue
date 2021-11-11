<template>
  <div>
    <canvas
      ref="canvas"
      @click="status = status === 'playing' ? 'paused' : 'playing'"
    ></canvas>
    <GlobalEvents target="window" @resize="setSize" />
  </div>
</template>

<script>
import * as dat from 'dat.gui';
import Stats from 'stats.js';

import recordMixin from '../mixins/record';
import * as random from '../utils/random';

export default {
  mixins: [recordMixin],
  data: () => ({
    status: 'playing',
    width: undefined,
    height: undefined,
    layers: [],
    lastRefresh: 0,

    config: {
      parts: 4,
      layers: 3,
      layersVariation: 2,
      minSegments: 3,
      maxSegments: 15,
      minVelocity: 0.04,
      maxVelocity: 0.2,
      velocityVariation1: 0.15,
      velocityVariation2In: 0.25,
      velocityVariation2Out: 0.45,
      refreshEvery: 1,
    },
  }),
  mounted() {
    this.setSize();
    this.init().then(() => {
      this.frame();

      if (false) {
        this.record({
          width: 1000,
          height: 1000,
          fps: 25,
          duration: 10e3,
          directory: '',
          background: 'black',
        });
      }
    });

    const gui = new dat.GUI();
    this.gui = gui;

    if (window.frameElement) {
      gui.close();
    }

    gui.add(this.config, 'parts', 1, 10, 1);
    gui.add(this.config, 'layers', 1, 10, 1);
    gui.add(this.config, 'layersVariation', 0, 5, 1);
    gui.add(this.config, 'minSegments', 1, 10, 1);
    gui.add(this.config, 'maxSegments', 10, 100, 1);
    gui.add(this.config, 'minVelocity', 0, 0.1);
    gui.add(this.config, 'maxVelocity', 0, 2);
    gui.add(this.config, 'velocityVariation1', 0, 1);
    gui.add(this.config, 'velocityVariation2In', 0, 2);
    gui.add(this.config, 'velocityVariation2Out', 0, 3);
    gui.add(this.config, 'refreshEvery', 0, 10);

    this.stats = new Stats();
    this.stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
    document.body.appendChild(this.stats.dom);
  },
  beforeDestroy() {
    cancelAnimationFrame(this.frameId);

    if (this.gui) {
      this.gui.destroy();
    }
    if (this.stats) {
      this.stats.dom.remove();
      delete this.stats;
    }
  },
  methods: {
    setSize() {
      const canvas = this.$refs.canvas;
      this.ctx = canvas.getContext('2d');

      const dpr = window.devicePixelRatio;
      this.width = canvas.clientWidth * dpr;
      this.height = canvas.clientHeight * dpr;
      canvas.width = this.width;
      canvas.height = this.height;
    },
    init() {
      this.generateLayers();
      return Promise.resolve();
    },
    frame(timestamp = 0) {
      if (this.status !== 'recording') {
        this.frameId = requestAnimationFrame(this.frame);
      }

      if (this.status === 'paused') {
        return;
      }

      this.stats.begin();

      const t = timestamp / 1e3;
      const { width, height, ctx, layers, config } = this;

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = 'black';

      if (
        config.refreshEvery &&
        Date.now() - this.lastRefresh > config.refreshEvery * 1e3
      ) {
        this.generateLayers();
      }

      const getLayerVal = (layer, v) => {
        const offset =
          layer.initialOffset +
          layer.velocity * t +
          Math.sin((t + 1000) * layer.velocityVariation2In) *
            layer.velocityVariation2Out;
        // todo 1e6 is a hack for if offset is negative, fix that
        const index = Math.floor(((v + offset + 1e6) % 1) * layer.data.length);
        return layer.data[index];
      };

      const partWidth = width / config.parts;

      for (let x = 0; x < config.parts; x++) {
        let startY = 0;
        let currentVal = 0;
        for (let y = 0; y < height; y++) {
          const v = y / height;
          const val = layers[x].reduce((acc, l) => acc + getLayerVal(l, v), 0);

          if (y === 0) {
            currentVal = val;
            continue;
          }

          if (val === currentVal && y !== height - 1) {
            continue;
          }

          if (val % 2) {
            ctx.fillRect(partWidth * x, startY, partWidth, y - startY);
          }
          startY = y;
          currentVal = val;
        }
      }

      this.stats.end();
    },
    generateLayers() {
      this.layers = [];

      const { config } = this;

      const segmentRange = config.maxSegments - config.minSegments;
      const velocityRange = config.maxVelocity - config.minVelocity;

      for (let part = 0; part < config.parts; part++) {
        const part = [];
        this.layers.push(part);

        const layers = Math.max(
          config.layers +
            random.roundRange(-config.layersVariation, config.layersVariation),
          1
        );

        for (let i = 0; i < layers; i++) {
          const segs = Math.round(
            config.minSegments +
              segmentRange * (random.range(i, i + 1) / config.layers)
          );

          const data = new Array(segs).fill(0).map(() => random.pick([0, 1]));

          const velocity =
            config.minVelocity +
            velocityRange * (i / config.layers) +
            random.range(-config.velocityVariation1, config.velocityVariation1);

          part.push({
            initialOffset: random.value(),
            velocity,
            velocityVariation2In: random.range(0, config.velocityVariation2In),
            velocityVariation2Out: random.range(
              0,
              config.velocityVariation2Out
            ),
            data,
          });
        }
      }

      this.lastRefresh = Date.now();
    },
  },
  watch: {
    config: { deep: true, handler: 'generateLayers' },
  },
};
</script>

<style scoped>
canvas {
  width: 100vw;
  height: 100vh;
}
</style>
