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
import { Engine, Render, Body, Bodies, Composite, Vector } from 'matter-js';
import Stats from 'stats.js';

import * as random from '../utils/random';

export default {
  data: () => ({
    status: 'playing',
    width: undefined,
    height: undefined,
    lastFrame: undefined,
    config: {
      boids: 100,
      boidVelocity: 5,
      boidCohesion: 1,
      boidSeparation: 0.5,
      boidAlignment: 1,
      separationDistance: 20,
      senseDistance: 300,
      debug: true,
    },
  }),
  mounted() {
    this.setSize();
    this.init().then(() => {
      this.frame();
    });

    const gui = new dat.GUI();
    this.gui = gui;

    if (window.frameElement) {
      gui.close();
    }

    gui.useLocalStorage = true;
    gui.remember(this.config);

    gui.add(this.config, 'boids', 0, 100, 1);
    gui.add(this.config, 'boidVelocity', 1, 20);
    gui.add(this.config, 'boidCohesion', 0, 20);
    gui.add(this.config, 'boidSeparation', 0, 1);
    gui.add(this.config, 'boidAlignment', 0, 20);
    gui.add(this.config, 'separationDistance', 0, 200);
    gui.add(this.config, 'senseDistance', 0, 1000);

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
          scale: 0,
        },
      });

      this.render = Render.create({
        canvas: ctx.canvas,
        engine: this.engine,
        options: {
          width: width,
          height: height,
          background: 'black',
          wireframes: config.debug,
          showAngleIndicator: config.debug,
        },
      });

      this.boidsComposite = Composite.create();

      for (let i = 0; i < config.boids; i++) {
        const boid = Bodies.circle(
          random.range(0, width),
          random.range(0, height),
          10,
          { frictionAir: 0, collisionFilter: { mask: 0 } }
        );
        const initialAngle = random.range(0, Math.PI * 2);
        Body.setAngle(boid, initialAngle);
        const x = config.boidVelocity * Math.cos(boid.angle);
        const y = config.boidVelocity * Math.sin(boid.angle);
        Body.setVelocity(boid, { x, y });

        Composite.add(this.boidsComposite, boid);
      }

      Composite.add(this.engine.world, [this.boidsComposite]);

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

      // Check < 1000 so it doesn't freak out after being paused
      const delta =
        lastFrame && lastFrame < 1000 ? timestamp - lastFrame : 1000 / 60;

      const boids = Composite.allBodies(this.boidsComposite);
      for (const boid of boids) {
        const nearby = boids.filter((other) => {
          if (other == boid) {
            return false;
          }
          const xDist = Math.abs(boid.position.x - other.position.x);
          const yDist = Math.abs(boid.position.y - other.position.y);
          return (xDist ** 2 + yDist ** 2) ** 0.5 < config.senseDistance;
        });

        if (nearby.length) {
          // Cohesion
          let totalX = 0;
          let totalY = 0;

          // Alignment
          let totalAngle = 0;

          for (const other of nearby) {
            totalX += other.position.x;
            totalY += other.position.y;
            totalAngle += other.angle;
          }

          // Cohesion
          const averagePositionX = totalX / nearby.length;
          const averagePositionY = totalY / nearby.length;
          let cohesionVec = Vector.create(
            averagePositionX - boid.position.x,
            averagePositionY - boid.position.y
          );
          cohesionVec = Vector.normalise(cohesionVec);
          cohesionVec = Vector.mult(cohesionVec, config.boidCohesion);

          // Separation
          let separateVec = Vector.create(0, 0);
          for (let other of nearby) {
            const vec = Vector.create(
              boid.position.x - other.position.x,
              boid.position.y - other.position.y
            );
            const dist = Vector.magnitude(vec);
            if (dist < config.separationDistance) {
              const angle = Vector.angle({ x: 1, y: 0 }, vec);
              const inverseVec = Vector.create(
                vec.x - config.separationDistance * Math.cos(angle),
                vec.y - config.separationDistance * Math.sin(angle)
              );
              separateVec = Vector.add(separateVec, inverseVec);
            }
          }
          separateVec = Vector.mult(separateVec, config.boidCohesion);
          if (Vector.magnitude(separateVec) > 1) {
            separateVec = Vector.normalise(separateVec);
          }

          // Alignment
          // todo check whether angle is expensive vs position
          const alignmentAngle = totalAngle / nearby.length;
          const alignmentVec = Vector.create(
            config.boidAlignment * Math.cos(alignmentAngle),
            config.boidAlignment * Math.sin(alignmentAngle)
          );

          // todo this is the incorrect way to do this
          let accelerationVec = Vector.create(0, 0);
          accelerationVec = Vector.add(accelerationVec, separateVec);
          accelerationVec = Vector.add(accelerationVec, alignmentVec);
          accelerationVec = Vector.add(accelerationVec, cohesionVec);
          accelerationVec = Vector.normalise(accelerationVec);
          accelerationVec = Vector.mult(accelerationVec, config.boidVelocity);

          const newVelocity = Vector.add(boid.velocity, accelerationVec);
          Body.setVelocity(boid, newVelocity);

          const angle = Vector.angle({ x: 1, y: 0 }, newVelocity);
          Body.setAngle(boid, angle);
        }
      }

      Engine.update(this.engine, delta);
      Render.world(this.render);

      this.stats.end();

      this.lastFrame = timestamp;
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
