import * as twgl from 'twgl.js';

import { doWorkOffscreen } from '@/utils/canvas/utils';
import * as random from '@/utils/random';
import TweakpanePlugin from '@/utils/plugins/tweakpane';
import type { SketchConfig, InitFn, FrameFn } from '@/utils/renderers/vanilla';

export const meta = {
  name: 'Sticky particles',
  date: '2023-03-14',
  tags: ['WebGL'],
};

const glsl = String.raw;

export interface CanvasState {
  programInfo: twgl.ProgramInfo;
  bufferInfo: twgl.BufferInfo;
  backgroundTexture: WebGLTexture;
}

const userConfig = {
  particles: 10000,
};
export type UserConfig = typeof userConfig;

const tweakpanePlugin = new TweakpanePlugin<CanvasState, UserConfig>();

export const sketchConfig: Partial<SketchConfig<CanvasState, UserConfig>> = {
  type: 'webgl2',
  userConfig,
  plugins: [tweakpanePlugin],
};

function initBackground({ width, height }: { width: number; height: number }) {
  const canvasWidth = width / 16;
  const canvasHeight = height / 16;

  return doWorkOffscreen(canvasWidth, canvasHeight, (ctx) => {
    const text = 'Hello world';

    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    ctx.fillStyle = 'white';
    ctx.font = `100 ${30}px sans-serif`;
    ctx.textAlign = 'center';

    const textHeight = ctx.measureText(text).actualBoundingBoxAscent;
    ctx.fillText(text, canvasWidth / 2, canvasHeight / 2 + textHeight / 2);
  });
}

const vertexShader = glsl`#version 300 es

uniform float u_timestamp;
uniform vec2 u_resolution;
uniform float u_particleSize;
uniform sampler2D u_backgroundTexture;

in vec2 a_particlePosition;

out float v_color;

void main() {
  gl_PointSize = u_particleSize;
  gl_Position = vec4(a_particlePosition, 0.0, 1.0);

  v_color = texture(u_backgroundTexture, a_particlePosition / 2.0 + 0.5).r;
}
`;

const fragmentShader = glsl`#version 300 es

precision mediump float;

uniform vec3 u_particleColor;

in float v_color;
out vec4 o_fragColor;

void main() {
  o_fragColor = vec4(u_particleColor * v_color, 1.0);
}
`;

export const init: InitFn<CanvasState, UserConfig> = (props) => {
  const { gl2: gl } = props;
  if (!gl) throw new Error('???');

  props.testSupport(() => {
    if (!('OffscreenCanvas' in window)) {
      return 'This sketch requires OffscreenCanvas';
    }
    return true;
  });

  twgl.addExtensionsToContext(gl);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  const programInfo = twgl.createProgramInfo(gl, [
    vertexShader,
    fragmentShader,
  ]);

  const indexesArray = new Float32Array(userConfig.particles);
  const particlePositionsArray = new Float32Array(userConfig.particles * 2);

  for (let i = 0; i < userConfig.particles; i++) {
    indexesArray[i] = i;
    particlePositionsArray[i * 2] = random.range(-1, 1);
    particlePositionsArray[i * 2 + 1] = random.range(-1, 1);
  }

  const arrays: twgl.Arrays = {
    a_particlePosition: {
      numComponents: 2,
      data: particlePositionsArray,
      divisor: 1,
    },
  };
  const bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays);

  const backgroundTexture = twgl.createTexture(gl, {
    src: initBackground(props),
  });

  return { programInfo, bufferInfo, backgroundTexture };
};

export const frame: FrameFn<CanvasState, UserConfig> = (props) => {
  const { gl2: gl, state, width, height, userConfig, timestamp, hasChanged } = props;
  if (!gl) throw new Error('???');

  if (hasChanged) {
    state.programInfo = twgl.createProgramInfo(gl, [
      vertexShader,
      fragmentShader,
    ]);

    state.backgroundTexture = twgl.createTexture(gl, {
      src: initBackground(props),
    });
  }

  const { programInfo, bufferInfo } = state;

  // https://colorhunt.co/palette/2d27274135438f43eef0eb8d
  gl.clearColor(45 / 256, 39 / 256, 39 / 256, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  const uniforms = {
    u_timestamp: timestamp,
    u_resolution: [width, height],
    u_particleSize: 5,
    u_particleColor: [240 / 256, 235 / 256, 141 / 256],
    u_backgroundTexture: state.backgroundTexture,
  };

  gl.useProgram(programInfo.program);
  twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo);
  twgl.setUniforms(programInfo, uniforms);
  twgl.drawBufferInfo(
    gl,
    bufferInfo,
    gl.POINTS,
    2,
    0,
    userConfig.particles
  );
};
