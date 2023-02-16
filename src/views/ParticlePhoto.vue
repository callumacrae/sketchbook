<template>
  <div class="canvas-wrapper">
    <canvas
      ref="canvas"
      @click="status = status === 'playing' ? 'paused' : 'playing'"
    ></canvas>
    <GlobalEvents target="window" @resize="setSize" />
  </div>
</template>

<script>
import SimplexNoise from 'simplex-noise';

const simplex = new SimplexNoise('setseed');

export default {
  data: () => ({
    status: 'playing',
    width: undefined,
    height: undefined,
    config: {
      particles: 7.5e3,
      particleNoiseXInFactor: 1 / 750,
      particleNoiseYInFactor: 1 / 200,
      particleNoiseXOutFactor: 40,
      particleNoise2YInFactor: 1 / 1.5e5,
      particleNoise2YOutFactor: 1e5,
      particleBaseSpeed: -4,
      particleMaxRadius: 3.5,
      quality: 1, // 0 = no randomness, 1 = noisy direction, 2 = noisy speed + direction
      pixelDataSampleSize: 6 // smaller = better performance but faster gradients
    }
  }),
  mounted() {
    this.setSize();
    this.init().then(() => this.frame());
  },
  beforeUnmount() {
    cancelAnimationFrame(this.frameId);
  },
  methods: {
    setSize() {
      const canvas = this.$refs.canvas;
      this.ctx = canvas.getContext('2d');

      const dpr = 1; // window.devicePixelRatio;
      this.width = canvas.clientWidth * dpr;
      this.height = canvas.clientHeight * dpr;
      canvas.width = this.width;
      canvas.height = this.height;
    },
    init() {
      const { config } = this;

      if (config.quality < 2) {
        const particleData = [];

        for (let i = 0; i < config.particles; i++) {
          // The 0.5s prevents banding (idk why)
          particleData.push({
            initialOffset: (simplex.noise2D(i + 0.5, 0) + 1) * 1e5,
            speed:
              (simplex.noise2D(0, i + 0.5) + 0.8) * config.particleBaseSpeed
          });
        }

        this.particleData = particleData;
      }

      return new Promise((resolve, reject) => {
        const img = new Image();
        img.addEventListener('load', () => {
          const imgCanvas = document.createElement('canvas');
          imgCanvas.width = img.width;
          imgCanvas.height = img.height;

          const ctx = imgCanvas.getContext('2d');
          ctx.drawImage(img, 0, 0, img.width, img.height);

          this.imageCtx = ctx;
          resolve();
        });
        img.addEventListener('error', reject);
        // @todo probs use webpack for this
        img.src =
          '/assets/particle-photos/frida-bredesen-c_cPNXlovvY-unsplash-small.png';
      });
    },
    frame(timestamp = 0) {
      this.frameId = requestAnimationFrame(this.frame);

      if (this.status === 'paused') {
        return;
      }

      const t = timestamp / 1e3;
      const { width, height, ctx, config, particleData } = this;

      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, width, height);

      for (let i = 0; i < config.particles; i++) {
        const x = (width / config.particles) * i;

        let y;
        if (config.quality < 2) {
          const { initialOffset, speed } = particleData[i];
          y = (initialOffset + speed * t) % height;
        } else {
          const offset =
            (simplex.noise2D(i, t * config.particleNoise2YInFactor) + 1) *
            config.particleNoise2YOutFactor;
          y = (offset + config.particleBaseSpeed * t) % height;
        }

        const realPosition = this.transformPoint([x, y]);
        const imageValue = this.getDataForPixel(realPosition);

        if (imageValue > 40) {
          const opacity = imageValue / 400;
          ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;

          const radius = (imageValue / 256) * config.particleMaxRadius;

          ctx.beginPath();
          ctx.arc(...realPosition, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
    getDataForPixel([x, y]) {
      const { width, height, imageCtx, config } = this;

      const transformedX = (x * imageCtx.canvas.width) / width;
      const transformedY = (y * imageCtx.canvas.height) / height;

      const halfSampleSize = Math.floor(config.pixelDataSampleSize / 2);
      const imageData = imageCtx.getImageData(
        transformedX - halfSampleSize,
        transformedY - halfSampleSize,
        halfSampleSize * 2,
        halfSampleSize * 2
      ).data;

      let totalR = 0;
      for (let i = 0; i < imageData.length; i += 4) {
        totalR += imageData[i];
      }
      const averageR = totalR / (imageData.length / 4);
      return averageR;
    },
    transformPoint([x, y]) {
      const { config } = this;

      if (config.quality === 0) {
        return [x, y];
      }

      const noise = simplex.noise2D(
        x * config.particleNoiseXInFactor,
        y * config.particleNoiseYInFactor
      );
      return [x + noise * config.particleNoiseXOutFactor, y];
    }
  }
};
</script>

<style scoped>
.canvas-wrapper {
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;

  background-color: black;
}

canvas {
  /* width: 100vw; */
  /* height: 100vh; */
  width: 500px;
  height: 500px;
}
</style>
