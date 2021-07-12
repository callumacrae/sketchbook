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

import * as twgl from 'twgl.js/dist/4.x/twgl-full.module';

export default {
  data: () => ({
    status: 'playing',
    width: undefined,
    height: undefined
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
      const { gl } = this;

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      this.programInfo = twgl.createProgramInfo(gl, [
        vertexShaderSource,
        fragmentShaderSource
      ]);

      const circlePoints = [];
      const r = 1;
      const segments = 100;
      for (let i = 0; i < segments; i++) {
        circlePoints.push([
          r * Math.cos(((2 * Math.PI) / segments) * i),
          r * Math.sin(((2 * Math.PI) / segments) * i)
        ]);
      }

      const data = [];
      for (let i = 0; i < circlePoints.length; i++) {
        const pointA = circlePoints[i];
        const pointB = circlePoints[i + 1] || circlePoints[0];
        data.push(0, 0, ...pointA, ...pointB);
      }

      const arrays = {
        a_position: {
          numComponents: 2,
          data: data
        }
      };

      this.bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays);
      twgl.setBuffersAndAttributes(gl, this.programInfo, this.bufferInfo);
    },
    frame(timestamp = 0) {
      // this.frameId = requestAnimationFrame(this.frame);

      if (this.status !== 'playing') {
        return;
      }

      const { gl, programInfo, width, height } = this;

      gl.viewport(0, 0, width, height);
      gl.useProgram(programInfo.program);
      gl.disable(gl.DEPTH_TEST);

      for (let i = 0; i < 2; i++) {
        const uniforms = {
          u_aspect: width / height,
          u_id: i / 15,
          u_scale: 0.1,
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
