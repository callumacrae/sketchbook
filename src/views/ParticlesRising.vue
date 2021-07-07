<template>
  <div>
    <canvas
      ref="canvas"
      @click="status = status === 'playing' ? 'paused' : 'playing'"
    ></canvas>
    <GlobalEvents target="window" @resize="init" />
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
      particles: 2000,
      particleBaseSpeed: -10,
      quality: 1 // 0 = no randomness, 1 = noisy direction, 2 = noisy speed + direction
    }
  }),
  mounted() {
    this.setSize();
    this.init();
    this.frame();
  },
  beforeDestroy() {
    cancelAnimationFrame(this.frameId);
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

        const opacity = 1;
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;

        let y;
        if (config.quality < 2) {
          const { initialOffset, speed } = particleData[i];
          y = (initialOffset + speed * t) % height;
        } else {
          const offset = (simplex.noise2D(i, t / 5e4) + 1) * 1e5;
          y = (offset + config.particleBaseSpeed * t) % height;
        }

        ctx.beginPath();
        ctx.arc(...this.transformPoint([x, y]), 3, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    transformPoint([x, y]) {
      if (this.config.quality === 0) {
        return [x, y];
      }
      const noise = simplex.noise2D(x / 750, y / 200);
      return [x + noise * 40, y];
    }
  }
};
</script>

<style scoped>
canvas {
  width: 100vw;
  height: 100vh;
}
</style>
