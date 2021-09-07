<template>
  <div class="canvas-container">
    <canvas
      ref="canvas"
      @click="status = status === 'playing' ? 'paused' : 'playing'"
    ></canvas>
    <GlobalEvents target="window" @resize="setSize" />
    <!-- this has to be visible or video doesn't play -->
    <video autoplay></video>
  </div>
</template>

<script>
import * as dat from 'dat.gui';
import { Engine, Render, Body, Bodies, Composite } from 'matter-js';
import Stats from 'stats.js';

import * as random from '../utils/random';
import recordMixin from '../mixins/record';

import backgroundImage from '../assets/projection-gravity/test-image-2.jpg';

export default {
  mixins: [recordMixin],
  data: () => ({
    status: 'playing',
    width: undefined,
    height: undefined,
    lastFrame: undefined,
    lastRefresh: Date.now(),
    config: {
      gravityScale: 0.002,
      ballsPerSecond: 5,
      maxBalls: 50,
      ballRadius: 0.025,
      ballBounce: 0.8,
      walls: true,
      ground: false,
      platformOpacity: 1,
      useCamera: false,
      cameraIndex: 0,
      edgeThreshold: 0.5,
      minSize: 50e3,
      maxSize: 200e3,
      refreshPerSecond: 0,
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
    this.contourWorker = new Worker(
      new URL('./ProjectionGravity-worker.js', import.meta.url)
    );

    this.contourWorker.onmessage = msg => this.handleWorkerMessage(msg);

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

    gui.useLocalStorage = true;
    gui.remember(this.config);
    gui.remember(this.config.transforms);

    gui.add(this.config, 'gravityScale', 0, 0.01);
    gui.add(this.config, 'ballsPerSecond', 1, 50, 1);
    gui.add(this.config, 'maxBalls', 1, 500, 1);
    gui.add(this.config, 'ballRadius', 0.001, 0.1);
    gui.add(this.config, 'ballBounce', 0, 1);
    gui.add(this.config, 'walls');
    gui.add(this.config, 'ground');

    const imageGui = gui.addFolder('Platform generation');

    imageGui.add(this.config, 'platformOpacity', 0, 1);
    imageGui.add(this.config, 'useCamera');
    const cameraController = imageGui.add(this.config, 'cameraIndex', 0, 3, 1);
    imageGui.add(this.config, 'edgeThreshold', 0, 1);
    imageGui.add(this.config, 'minSize', 0, 100e3);
    imageGui.add(this.config, 'maxSize', 0, 200e3);
    imageGui.add(this.config, 'refreshPerSecond', 0, 15);
    imageGui
      .add({ refresh: () => this.syncPlatforms(false) }, 'refresh')
      .name('Manually refresh image');

    imageGui.add(this.config.transforms, 'x1', 0, 1);
    imageGui.add(this.config.transforms, 'y1', 0, 1);
    imageGui.add(this.config.transforms, 'x2', 0, 1);
    imageGui.add(this.config.transforms, 'y2', 0, 1);
    imageGui.add(this.config.transforms, 'x3', 0, 1);
    imageGui.add(this.config.transforms, 'y3', 0, 1);
    imageGui.add(this.config.transforms, 'x4', 0, 1);
    imageGui.add(this.config.transforms, 'y4', 0, 1);

    navigator.mediaDevices.enumerateDevices().then(devices => {
      const cameras = devices.filter(({ kind }) => kind === 'videoinput');
      if (cameras.length === 1) {
        imageGui.remove(cameraController);

        // Set to 0 in case something else is remembered
        this.config.cameraIndex = 0;
      } else {
        cameraController.max(cameras.length - 1);
      }

      this.cameras = cameras;
    });

    this.stats = new Stats();
    this.stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
    document.body.appendChild(this.stats.dom);
  },
  beforeDestroy() {
    cancelAnimationFrame(this.frameId);

    if (this.contourWorker) {
      this.contourWorker.terminate();
    }

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

      if (
        config.refreshPerSecond &&
        Date.now() - this.lastRefresh > 1000 / config.refreshPerSecond
      ) {
        this.syncPlatforms(false);
        this.lastRefresh = Date.now();
      }

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
          fillStyle: 'white'
        }
      };

      const radius = config.ballRadius * width;
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
    syncPlatforms(useCache = true, cacheCamera = true) {
      // The cache is for when adjusting the transforms without reading the
      // image or video again
      if (
        this._cachedImageData &&
        // If cache data has been moved to previous thread we can't use it
        this._cachedImageData.data.buffer.byteLength &&
        useCache
      ) {
        this.platformsFromData(this._cachedImageData);
      } else if (this.config.useCamera) {
        const videoEl = document.querySelector('video');

        const readyFn = () => {
          const n = videoEl.width;
          const m = videoEl.height;

          const tmpCanvas = document.createElement('canvas');
          tmpCanvas.width = n;
          tmpCanvas.height = m;
          const ctx = tmpCanvas.getContext('2d');

          ctx.drawImage(videoEl, 0, 0);
          const data = ctx.getImageData(0, 0, n, m);

          this.platformsFromData(data);

          this._cachedImageData = data;

          // Event might not be added, that's fine
          videoEl.removeEventListener('playing', readyFn);
        };

        if (cacheCamera && videoEl.readyState === 4) {
          readyFn();
        } else {
          const cameraId = this.cameras[this.config.cameraIndex].deviceId;
          navigator.mediaDevices
            .getUserMedia({ video: { deviceId: { exact: cameraId } } })
            .then(stream => {
              videoEl.srcObject = stream;

              const track = stream.getVideoTracks()[0];

              const {
                width: { max: n },
                height: { max: m }
              } = track.getCapabilities();

              videoEl.width = n;
              videoEl.height = m;

              videoEl.addEventListener('playing', readyFn);
            });
        }
      } else {
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

          this.platformsFromData(data);

          this._cachedImageData = data;
        };
        imgEl.src = backgroundImage;
      }
    },
    // move ready to be used when doing real time stuff, but breaks caching so
    // not suitable for using with an image or still of a video
    platformsFromData(data, move = false) {
      // This is too expensive to do on main thread while animation is running
      this.contourWorker.postMessage(
        {
          data: data.data.buffer,
          inWidth: data.width,
          inHeight: data.height,
          config: this.config,
          outWidth: this.width,
          outHeight: this.height
        },
        move ? undefined : [data.data.buffer]
      );
    },
    handleWorkerMessage(msg) {
      const { config } = this;

      Composite.clear(this.platformComposite);

      for (const { vertices, minX, minY } of msg.data) {
        const platform = Bodies.fromVertices(0, 0, [vertices], {
          isStatic: true,
          render: {
            fillStyle: this.platformFill
          }
        });

        if (platform.area > config.minSize && platform.area < config.maxSize) {
          Composite.add(this.platformComposite, [platform]);

          Body.setPosition(platform, {
            x: minX - platform.bounds.min.x,
            y: minY - platform.bounds.min.y
          });
        }
      }
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
    },
    'config.useCamera'() {
      this.syncPlatforms(false);
    },
    'config.cameraIndex'() {
      const camera = this.cameras[this.config.cameraIndex];
      console.info(`Switching to camera: ${camera.label}`);
      this.syncPlatforms(false, false);
    },
    'config.edgeThreshold': 'syncPlatforms',
    'config.minSize': 'syncPlatforms',
    'config.maxSize': 'syncPlatforms'
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
