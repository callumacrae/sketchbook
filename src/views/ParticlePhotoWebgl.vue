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
import fragmentShaderSource from './ParticlePhoto-fragment.glsl';
import vertexShaderSource from './ParticlePhoto-vertex.glsl';

import * as twgl from 'twgl.js/dist/4.x/twgl-full.module';

import * as random from '../utils/random';
random.setSeed('setseed');

export default {
  data: () => ({
    status: 'playing',
    width: undefined,
    height: undefined,
    config: {
      particles: 10e3,
      particleSegments: 10,
      particleBaseSpeed: 5,

      imageSrc:
        '/assets/particle-photos/frida-bredesen-c_cPNXlovvY-unsplash-small.png'
    }
  }),
  mounted() {
    this.setSize();
    this.init().then(() => this.frame());
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

      const ext = gl.getExtension('ANGLE_instanced_arrays');
      if (!ext) {
        throw new Error('need ANGLE_instanced_arrays');
      }
      this.ext = ext;
      twgl.addExtensionsToContext(gl);

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

      const particleData = {
        xs: [],
        initialOffsets: [],
        speeds: []
      };
      for (let i = 0; i < config.particles; i++) {
        particleData.xs.push(i / config.particles);
        particleData.initialOffsets.push(random.range(-1, 1));
        particleData.speeds.push(random.range(0, config.particleBaseSpeed));
      }

      this.particleData = particleData;

      twgl.setAttributePrefix('a_');
      this.bufferInfo = twgl.createBufferInfoFromArrays(gl, {
        circle_positions: {
          numComponents: 2,
          data: data
        },
        x: {
          numComponents: 1,
          data: particleData.xs,
          divisor: 1
        },
        initial_offset: {
          numComponents: 1,
          data: particleData.initialOffsets,
          divisor: 1
        },
        speed: {
          numComponents: 1,
          data: particleData.speeds,
          divisor: 1
        }
      });
      twgl.setBuffersAndAttributes(gl, this.programInfo, this.bufferInfo);

      return new Promise(resolve => {
        this.imageTexture = twgl.createTexture(
          gl,
          { src: config.imageSrc },
          resolve
        );
      });
    },
    frame(timestamp = 0) {
      this.frameId = requestAnimationFrame(this.frame);

      if (this.status !== 'playing') {
        return;
      }

      const { gl, programInfo, bufferInfo, width, height, config } = this;

      gl.viewport(0, 0, width, height);
      gl.useProgram(programInfo.program);

      const uniforms = {
        u_aspect: width / height,
        u_time: timestamp,
        u_image_texture: this.imageTexture
      };

      twgl.setUniforms(programInfo, uniforms);
      twgl.drawBufferInfo(
        gl,
        bufferInfo,
        gl.TRIANGLES,
        bufferInfo.numElements,
        0,
        config.particles
      );
    }
  }
};
</script>

<style scoped>
canvas {
  /* width: 100vw; */
  /* height: 100vh; */
  width: 1000px;
  height: 1000px;
  background-color: black;
}
</style>
