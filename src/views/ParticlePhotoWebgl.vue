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
import fragmentShaderSource from './ParticlePhoto-fragment.glsl';
import vertexShaderSource from './ParticlePhoto-vertex.glsl';

import * as twgl from 'twgl.js/dist/4.x/twgl-full.module';

import recordMixin from '../mixins/record';
import * as random from '../utils/random';
random.setSeed('setseed');

export default {
  mixins: [recordMixin],
  data: () => ({
    status: 'playing',
    width: undefined,
    height: undefined,
    config: {
      particles: 30e3,
      particleSegments: 10,
      particleBaseSpeed: 5,

      // Use a blurred image instead of sampling an area of more than one pixel
      // in the fragment shader - do the work ahead of time!
      imageSrc:
        '/assets/particle-photos/thea-hoyer-CrJyu9HoeBg-unsplash-small-blurred.jpg'
    }
  }),
  mounted() {
    this.setSize();
    this.init().then(() => {
      this.frame();

      if (false) {
        this.record({
          width: 1000,
          height: 1500,
          fps: 25,
          duration: 10e3,
          directory: 'particle-photo-woman',
          background: 'black'
        });
      }
    });
  },
  beforeDestroy() {
    cancelAnimationFrame(this.frameId);
  },
  methods: {
    setSize() {
      const canvas = this.$refs.canvas;
      this.gl = canvas.getContext('webgl', { preserveDrawingBuffer: true });

      const dpr = 1;
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
        x: {
          numComponents: 1,
          data: particleData.xs
        },
        initial_offset: {
          numComponents: 1,
          data: particleData.initialOffsets
        },
        speed: {
          numComponents: 1,
          data: particleData.speeds
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
      if (this.status !== 'recording') {
        this.frameId = requestAnimationFrame(this.frame);
      }

      if (this.status === 'paused') {
        return;
      }

      const { gl, programInfo, bufferInfo, width, height } = this;

      gl.viewport(0, 0, width, height);
      gl.useProgram(programInfo.program);
      gl.clear(gl.COLOR_BUFFER_BIT);

      const uniforms = {
        u_time: timestamp,
        u_image_texture: this.imageTexture
      };

      twgl.setUniforms(programInfo, uniforms);
      twgl.drawBufferInfo(gl, bufferInfo, gl.POINTS);
    }
  }
};
</script>

<style scoped>
.canvas-container {
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
  width: 666px;
  height: 1000px;
}
</style>
