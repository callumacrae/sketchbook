<template>
  <div class="canvas-container">
    <canvas
      ref="canvas"
      @click="status = status === 'playing' ? 'paused' : 'playing'"
    ></canvas>
    <GlobalEvents target="window" @resize="setSize" />
  </div>
</template>

<script>
import * as dat from 'dat.gui';
import { Engine, Render, Body, Bodies, Composite } from 'matter-js';
import Stats from 'stats.js';

import * as random from '../utils/random';
import recordMixin from '../mixins/record';

export default {
  mixins: [recordMixin],
  data: () => ({
    status: 'playing',
    width: undefined,
    height: undefined,
    lastFrame: undefined,
    config: {
      gravityScale: 0.002,
      ballsPerSecond: 5,
      ballRadius: 0.025,
      ballBounce: 0.8,
      walls: true,
      ground: false
    }
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
          background: 'black'
        });
      }
    });

    const gui = new dat.GUI();
    this.gui = gui;

    if (window.frameElement) {
      gui.close();
    }

    gui.add(this.config, 'gravityScale', 0, 0.01);
    gui.add(this.config, 'ballsPerSecond', 1, 50, 1);
    gui.add(this.config, 'ballRadius', 0.001, 0.1);
    gui.add(this.config, 'ballBounce', 0, 1);
    gui.add(this.config, 'walls');
    gui.add(this.config, 'ground');

    this.stats = new Stats();
    this.stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
    document.body.appendChild(this.stats.dom);
  },
  beforeDestroy() {
    cancelAnimationFrame(this.frameId);

    if (this.engine) {
      Engine.clear(this.engine);
    }

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
      const { ctx, config, width, height } = this;

      this.engine = Engine.create({
        gravity: {
          scale: config.gravityScale
        }
      });

      this.render = Render.create({
        canvas: ctx.canvas,
        engine: this.engine,
        options: {
          width: width,
          height: height,
          background: 'black',
          wireframes: false
        }
      });

      const platformOptions = {
        isStatic: true,
        render: {
          fillStyle: 'white'
        }
      };

      const platform = Bodies.rectangle(
        this.uToX(0.5),
        this.vToY(0.5),
        this.uToX(0.2),
        this.vToY(0.05),
        { ...platformOptions, angle: Math.PI / 10 }
      );
      this.groundBody = Bodies.rectangle(
        width / 2,
        height + 30,
        width,
        60,
        platformOptions
      );

      const wallLeft = Bodies.rectangle(
        -11,
        height / 2,
        20,
        height,
        platformOptions
      );
      const wallRight = Bodies.rectangle(
        width + 11,
        height / 2,
        20,
        height,
        platformOptions
      );
      this.wallsComposite = Composite.create({ bodies: [wallLeft, wallRight] });

      this.platformComposite = Composite.create();

      Composite.add(this.platformComposite, [
        platform,
        this.groundBody,
        this.wallsComposite
      ]);

      this.handleConfigGroundUpdate();

      this.ballsComposite = Composite.create();

      Composite.add(this.engine.world, [
        this.platformComposite,
        this.ballsComposite
      ]);

      return Promise.resolve();
    },
    frame(timestamp = 0) {
      this.stats.begin();

      if (this.status !== 'recording') {
        this.frameId = requestAnimationFrame(this.frame);
      }

      if (this.status === 'paused') {
        return;
      }

      const { config, lastFrame } = this;

      this.cleanupBalls();

      // Check < 1000 so it doesn't freak out after being paused
      const delta =
        lastFrame && lastFrame < 1000 ? timestamp - lastFrame : 1000 / 60;

      if (random.value() < (delta / 1e3) * config.ballsPerSecond) {
        this.addBall();
      }

      Engine.update(this.engine, delta);
      Render.world(this.render);

      this.stats.end();

      this.lastFrame = timestamp;
    },
    uToX(u) {
      return u * this.width;
    },
    vToY(v) {
      return v * this.height;
    },
    cleanupBalls() {
      const balls = Composite.allBodies(this.ballsComposite);

      for (let ball of balls) {
        if (ball.position.y > this.height + 50) {
          Composite.remove(this.ballsComposite, ball);
        }
      }
    },
    addBall() {
      const { config, width } = this;

      const ballOptions = {
        restitution: config.ballBounce,
        render: {
          fillStyle: 'white'
        }
      };

      const radius = this.uToX(config.ballRadius);
      const x = random.range(radius, this.width - radius);
      const ball = Bodies.circle(x, radius * -2, radius, ballOptions);
      Composite.add(this.ballsComposite, [ball]);
    },
    handleConfigWallsUpdate() {
      const walls = Composite.allBodies(this.wallsComposite);
      for (let wall of walls) {
        wall.collisionFilter.mask = this.config.walls ? -1 : 0;
      }
    },
    handleConfigGroundUpdate() {
      this.groundBody.collisionFilter.mask = this.config.ground ? -1 : 0;
    }
  },
  watch: {
    'config.gravityScale'() {
      this.engine.gravity.scale = this.config.gravityScale;
    },
    'config.walls': 'handleConfigWallsUpdate',
    'config.ground': 'handleConfigGroundUpdate'
  }
};
</script>

<style scoped>
.canvas-container {
  height: 100vh;
  /* I have no idea why this is required */
  overflow: hidden;
}

canvas {
  width: 100vw;
  height: 100vh;
}
</style>
