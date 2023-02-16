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
import { Events, Engine, Render, Body, Bodies, Composite } from 'matter-js';
import Stats from 'stats.js';
import { scalePow } from 'd3-scale';

import * as random from '../utils/random';
import * as perf from '../utils/perf';
import recordMixin from '../mixins/record';
import cameraDetectionMixin from '../mixins/camera-detection';

import impactAudio from '../assets/projection-gravity/335908__littlerainyseasons__correct.mp3';

export default {
  mixins: [recordMixin, cameraDetectionMixin],
  data: () => ({
    status: 'playing',
    width: undefined,
    height: undefined,
    lastFrame: undefined,
    config: {
      gravityScale: 0.002,
      ballsPerSecond: 5,
      maxBalls: 50,
      ballRadius: 0.025,
      ballRadiusVar: 0,
      ballSaturation: 100,
      ballLightness: 100,
      ballBounce: 0.8,
      walls: true,
      ground: false,
      makeSound: false,
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

    gui.useLocalStorage = true;
    gui.remember(this.config);

    gui.add(this.config, 'gravityScale', 0, 0.01);
    gui.add(this.config, 'ballsPerSecond', 1, 50, 1);
    gui.add(this.config, 'maxBalls', 1, 500, 1);
    gui.add(this.config, 'ballRadius', 0.001, 0.1);
    gui.add(this.config, 'ballRadiusVar', 0, 1);
    gui.add(this.config, 'ballSaturation', 0, 100, 1);
    gui.add(this.config, 'ballLightness', 0, 100, 1);
    gui.add(this.config, 'ballBounce', 0, 1);
    gui.add(this.config, 'walls');
    gui.add(this.config, 'ground');
    gui.add(this.config, 'makeSound');

    const imageGui = gui.addFolder('Platform generation');

    this.setupDatGui(gui, imageGui);

    this.stats = new Stats();
    this.stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
    document.body.appendChild(this.stats.dom);
  },
  beforeUnmount() {
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
          scale: config.gravityScale,
        },
      });

      this.render = Render.create({
        canvas: ctx.canvas,
        engine: this.engine,
        options: {
          width: width,
          height: height,
          background: 'black',
          wireframes: false,
        },
      });

      this.groundBody = Bodies.rectangle(width / 2, height + 30, width, 60, {
        isStatic: true,
      });

      const wallLeft = Bodies.rectangle(-11, height / 2, 20, height, {
        isStatic: true,
      });
      const wallRight = Bodies.rectangle(width + 11, height / 2, 20, height, {
        isStatic: true,
      });
      this.wallsComposite = Composite.create({ bodies: [wallLeft, wallRight] });
      this.platformComposite = Composite.create();

      this.syncPlatforms();

      Composite.add(this.engine.world, [
        this.groundBody,
        this.wallsComposite,
        this.platformComposite,
      ]);

      this.handleConfigGroundUpdate();

      this.ballsComposite = Composite.create();

      Composite.add(this.engine.world, [
        this.platformComposite,
        this.ballsComposite,
      ]);

      Events.on(this.engine, 'collisionStart', (e) => {
        if (this.config.makeSound) {
          const maxDepthCollision = e.pairs.reduce((max, pair) =>
            max.collision.depth > pair.collision.depth ? max : pair
          );
          this.playImpactSound(maxDepthCollision.collision.depth);
        }
      });

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

      this.detectionFrame(timestamp);

      this.stats.end();

      this.lastFrame = timestamp;
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
          fillStyle: `hsl(${random.range(0, 360)}, ${config.ballSaturation}%, ${
            config.ballLightness
          }%)`,
        },
      };

      const radius =
        config.ballRadius *
        (1 + random.range(-1, 1) * config.ballRadiusVar) *
        width;
      const x = random.range(radius, width - radius);
      const ball = Bodies.circle(x, radius * -2, radius, ballOptions);
      Composite.add(this.ballsComposite, [ball]);

      // This isn't in the cleanupBalls function as we can't reuse the `balls`
      // variable anyway after stuff has been removed and it's a nicer
      // experience here
      const balls = Composite.allBodies(this.ballsComposite);
      if (balls.length > config.maxBalls) {
        const toRemove = balls.length - config.maxBalls;
        for (let i = 0; i < toRemove; i++) {
          Composite.remove(this.ballsComposite, balls[i]);
        }
      }
    },
    cameraDetectionUpdate(msg) {
      perf.start('handleWorkerMessage');
      const { detectionConfig: config } = this;

      Composite.clear(this.platformComposite);

      for (const { vertices, minX, minY } of msg.data) {
        const platform = Bodies.fromVertices(0, 0, [vertices], {
          isStatic: true,
          render: {
            fillStyle: this.platformFill,
          },
        });

        if (platform.area > config.minSize && platform.area < config.maxSize) {
          Composite.add(this.platformComposite, [platform]);

          Body.setPosition(platform, {
            x: minX - platform.bounds.min.x,
            y: minY - platform.bounds.min.y,
          });
        }
      }
      perf.end('handleWorkerMessage');
      perf.end('sync platforms total');
    },
    handleConfigWallsUpdate() {
      const walls = Composite.allBodies(this.wallsComposite);
      for (let wall of walls) {
        wall.collisionFilter.mask = this.config.walls ? -1 : 0;
      }
    },
    handleConfigGroundUpdate() {
      this.groundBody.collisionFilter.mask = this.config.ground ? -1 : 0;
    },
    async playImpactSound(collisionDepth) {
      const audioContext = (this.audioContext ||= new AudioContext());

      if (!this.impactAudioBuffer) {
        const response = await fetch(impactAudio);
        this.impactAudioBuffer = await audioContext.decodeAudioData(
          await response.arrayBuffer()
        );
      }

      const gain = scalePow().exponent(1).domain([5, 50]).clamp(true)(
        collisionDepth
      );

      if (gain == 0) {
        return;
      }

      const gainNode = audioContext.createGain();
      gainNode.gain.value = gain;
      gainNode.connect(audioContext.destination);

      const trackSource = audioContext.createBufferSource();
      trackSource.buffer = this.impactAudioBuffer;
      trackSource.connect(gainNode);

      trackSource.detune.value = Math.random() * 100 - 50;
      trackSource.start();
    },
  },
  computed: {
    platformFill() {
      return `rgba(255, 255, 255, ${this.detectionConfig.platformOpacity}`;
    },
  },
  watch: {
    'config.gravityScale'() {
      this.engine.gravity.scale = this.config.gravityScale;
    },
    'config.walls': 'handleConfigWallsUpdate',
    'config.ground': 'handleConfigGroundUpdate',
    'detectionConfig.platformOpacity'() {
      for (let platform of Composite.allBodies(this.platformComposite)) {
        platform.render.fillStyle = this.platformFill;
      }
    },
  },
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
