<template>
  <canvas width="1000" height="1000"></canvas>
</template>

<script>
import SimplexNoise from 'simplex-noise';
import BlobCanvas from '../utils/textures/blobs';

export const meta = {
  name: 'Contour texture v2',
  date: '2020-06-01',
};

const simplex = new SimplexNoise();

export default {
  mounted() {
    this.blobCanvas = new BlobCanvas({
      context: this.$el.getContext('2d'),
      noise: simplex,
    });

    this.frame();
  },
  beforeUnmount() {
    cancelAnimationFrame(this.frameId);
  },
  methods: {
    frame(timestamp = 0) {
      this.blobCanvas.frame(timestamp);
      this.frameId = requestAnimationFrame(this.frame);
    },
  },
};
</script>

<style scoped>
canvas {
  width: 500px;
  height: 500px;
}
</style>
