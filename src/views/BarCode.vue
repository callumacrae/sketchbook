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

export default {
  mixins: [recordMixin],
  data: () => ({
    status: 'playing',
    width: undefined,
    height: undefined,
    layers: [],

    config: {
      parts: 4,
      layers: 3,
      minSegments: 3,
      maxSegments: 20,
      minVelocity: 0.05,
      maxVelocity: 0.3,
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
    gui.add(this.config, 'minSegments', 1, 10, 1);
    gui.add(this.config, 'maxSegments', 10, 100, 1);
    gui.add(this.config, 'minVelocity', 0, 0.1);
    gui.add(this.config, 'maxVelocity', 0, 2);

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

      const getLayerVal = (layer, v) => {
        const offset = layer.velocity * t;
        const index = Math.floor(((v + offset) % 1) * layer.data.length);
        return layer.data[index];
      };

      const partWidth = width / config.parts;

      for (let x = 0; x < config.parts; x++) {
        for (let y = 0; y < height; y++) {
          const v = y / height;
          const val = layers[x].reduce((acc, l) => acc + getLayerVal(l, v), 0);

          ctx.fillStyle = val % 2 ? 'black' : 'white';
          // todo support not-1 maybe
          ctx.fillRect(partWidth * x, y, partWidth, 1);
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

        for (let i = 0; i < config.layers; i++) {
          const segs = Math.round(
            config.minSegments + segmentRange * (i / config.layers)
          );

          const data = new Array(segs)
            .fill(0)
            .map(() => (Math.random() < 0.5 ? 0 : 1));

          const velocity =
            (config.minVelocity + velocityRange * (i / config.layers)) * Math.random() * 2;

          part.push({ velocity, data });
        }
      }
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
