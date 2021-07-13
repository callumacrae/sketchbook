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
import fragmentShaderSource from './ParticlesRising-fragment.glsl';
import vertexShaderSource from './ParticlesRising-vertex.glsl';

import SimplexNoise from 'simplex-noise';
import * as twgl from 'twgl.js/dist/4.x/twgl-full.module';

const simplex = new SimplexNoise('setseed');

export default {
  data: () => ({
    status: 'playing',
    width: undefined,
    height: undefined,
    config: {
      particles: 1000,
      particleSegments: 20,
      particleBaseSpeed: 10
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
      this.gl = canvas.getContext('webgl');

      const dpr = window.devicePixelRatio;
      this.width = canvas.clientWidth * dpr;
      this.height = canvas.clientHeight * dpr;
      canvas.width = this.width;
      canvas.height = this.height;
    },
    init() {
      const { gl, config } = this;

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      this.programInfo = twgl.createProgramInfo(gl, [
        vertexShaderSource,
        fragmentShaderSource
      ]);

      const circlePoints = [];
      const segments = this.config.particleSegments;
      for (let i = 0; i < segments; i++) {
        circlePoints.push([
          Math.cos(((2 * Math.PI) / segments) * i),
          Math.sin(((2 * Math.PI) / segments) * i)
        ]);
      }

      const data = [];
      for (let i = 0; i < circlePoints.length; i++) {
        const pointA = circlePoints[i];
        const pointB = circlePoints[i + 1] || circlePoints[0];
        data.push(0, 0, ...pointA, ...pointB);
      }

      twgl.setAttributePrefix('a_');
      this.bufferInfo = twgl.createBufferInfoFromArrays(gl, {
        circle_positions: {
          numComponents: 2,
          data: data
        }
      });
      twgl.setBuffersAndAttributes(gl, this.programInfo, this.bufferInfo);

      const particleData = [];
      for (let i = 0; i < config.particles; i++) {
        // The 0.5s prevents banding (idk why)
        particleData.push({
          initialOffset: simplex.noise2D(i + 0.5, 0),
          speed: (simplex.noise2D(0, i + 0.5) + 0.8) * config.particleBaseSpeed
        });
      }

      this.particleData = particleData;
    },
    frame(timestamp = 0) {
      this.frameId = requestAnimationFrame(this.frame);

      if (this.status !== 'playing') {
        return;
      }

      const { gl, programInfo, width, height, config, particleData } = this;

      gl.viewport(0, 0, width, height);
      gl.useProgram(programInfo.program);

      for (let i = 0; i < config.particles; i++) {
        const uniforms = {
          u_aspect: width / height,
          u_x: i / config.particles,
          u_time: timestamp,
          u_initial_offset: particleData[i].initialOffset,
          u_speed: particleData[i].speed,
        };

        twgl.setUniforms(programInfo, uniforms);
        twgl.drawBufferInfo(gl, this.bufferInfo);
      }
    }
  }
};
</script>

<style scoped>
canvas {
  width: 100vw;
  height: 100vh;
  background-color: rgba(255, 0, 0, 0.1);
}
</style>
