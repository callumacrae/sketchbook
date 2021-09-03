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
import { contours as d3Contours } from 'd3-contour';

import * as random from '../utils/random';
import recordMixin from '../mixins/record';

import backgroundImage from '../assets/projection-gravity/test-image.png';

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
      ground: false,
      platformOpacity: 1,
      transforms: {
        x1: 0,
        y1: 0,
        x2: 1,
        y2: 0,
        x3: 0,
        y3: 1,
        x4: 1,
        y4: 1
      }
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
    gui.add(this.config, 'platformOpacity', 0, 1);

    const transformsGui = gui.addFolder('Transforms');

    transformsGui.add(this.config.transforms, 'x1', 0, 1);
    transformsGui.add(this.config.transforms, 'y1', 0, 1);
    transformsGui.add(this.config.transforms, 'x2', 0, 1);
    transformsGui.add(this.config.transforms, 'y2', 0, 1);
    transformsGui.add(this.config.transforms, 'x3', 0, 1);
    transformsGui.add(this.config.transforms, 'y3', 0, 1);
    transformsGui.add(this.config.transforms, 'x4', 0, 1);
    transformsGui.add(this.config.transforms, 'y4', 0, 1);

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

      this.groundBody = Bodies.rectangle(width / 2, height + 30, width, 60, {
        isStatic: true
      });

      const wallLeft = Bodies.rectangle(-11, height / 2, 20, height, {
        isStatic: true
      });
      const wallRight = Bodies.rectangle(width + 11, height / 2, 20, height, {
        isStatic: true
      });
      this.wallsComposite = Composite.create({ bodies: [wallLeft, wallRight] });
      this.platformComposite = Composite.create();

      this.syncPlatforms();

      Composite.add(this.engine.world, [
        this.groundBody,
        this.wallsComposite,
        this.platformComposite
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
      const x = random.range(radius, width - radius);
      const ball = Bodies.circle(x, radius * -2, radius, ballOptions);
      Composite.add(this.ballsComposite, [ball]);
    },
    syncPlatforms() {
      const imgEl = new Image();
      imgEl.onload = () => {
        const tmpCanvas = document.createElement('canvas');
        const n = imgEl.width;
        const m = imgEl.height;
        tmpCanvas.width = n;
        tmpCanvas.height = m;
        const ctx = tmpCanvas.getContext('2d');

        ctx.drawImage(imgEl, 0, 0);
        const data = ctx.getImageData(0, 0, n, m);

        const values = new Float64Array(n * m);

        for (let j = 0, k = 0; j < m; ++j) {
          for (let i = 0; i < n; ++i, ++k) {
            // todo look at more than one channel
            values[k] = data.data[k * 4] / 255;
          }
        }

        const contours = d3Contours()
          .size([n, m])
          .contour(values, 0.5);

        const x1 = n * this.config.transforms.x1;
        const y1 = m * this.config.transforms.y1;
        const x2 = n * this.config.transforms.x2;
        const y2 = m * this.config.transforms.y2;
        const x3 = n * this.config.transforms.x3;
        const y3 = m * this.config.transforms.y3;
        const x4 = n * this.config.transforms.x4;
        const y4 = m * this.config.transforms.y4;

        const transformPoint = ([xIn, yIn]) => {
          const u1 = (xIn - x1) / (x2 - x1); // rename to uTop
          const u2 = (xIn - x3) / (x4 - x3); // uBottom
          const v1 = (yIn - y1) / (y3 - y1); // vLeft
          const v2 = (yIn - y2) / (y4 - y2); // vRight

          // I got these by solving simultaneous equations on paper lol
          const det = 1 - (u1 - u2) * (v1 - v2);
          const uOut = (u1 + v1 * (u2 - u1)) / det;
          const vOut = (v1 + u2 * (v2 - v1)) / det;

          return [uOut, vOut];
        };

        Composite.clear(this.platformComposite);

        // todo why is slice(1) required?
        for (let contour of contours.coordinates[0].slice(1)) {
          const vertices = contour.map(point => {
            const transformedPoint = transformPoint(point);

            return {
              x: transformedPoint[0] * this.width,
              y: transformedPoint[1] * this.height
            };
          });

          const [minX, minY] = vertices.reduce(
            ([minX, minY], { x, y }) => {
              return [Math.min(minX, x), Math.min(minY, y)];
            },
            [vertices[0].x, vertices[0].y]
          );

          const platform = Bodies.fromVertices(0, 0, [vertices], {
            isStatic: true,
            render: {
              fillStyle: this.platformFill
            }
          });
          Composite.add(this.platformComposite, [platform]);

          Body.setPosition(platform, {
            x: minX - platform.bounds.min.x,
            y: minY - platform.bounds.min.y
          });
        }
      };
      imgEl.src = backgroundImage;
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
  computed: {
    platformFill() {
      return `rgba(255, 255, 255, ${this.config.platformOpacity}`;
    }
  },
  watch: {
    'config.gravityScale'() {
      this.engine.gravity.scale = this.config.gravityScale;
    },
    'config.walls': 'handleConfigWallsUpdate',
    'config.ground': 'handleConfigGroundUpdate',
    'config.platformOpacity'() {
      for (let platform of Composite.allBodies(this.platformComposite)) {
        platform.render.fillStyle = this.platformFill;
      }
    },
    'config.transforms': {
      deep: true,
      handler: 'syncPlatforms'
    }
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
