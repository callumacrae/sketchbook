import * as twgl from 'twgl.js';

import TweakpanePlugin from '@/utils/plugins/tweakpane';
import type { SketchConfig, InitFn, FrameFn } from '@/utils/renderers/vanilla';

export const meta = {
  name: 'Hello world (webgl2)',
  date: '2023-03-15',
  tags: ['WebGL', 'Hello World'],
};

const glsl = String.raw;

export interface CanvasState {
  programInfo: twgl.ProgramInfo;
  vao: twgl.VertexArrayInfo;
}

const userConfig = {
  var: 1,
};
export type UserConfig = typeof userConfig;

const tweakpanePlugin = new TweakpanePlugin<CanvasState, UserConfig>();

export const sketchConfig: Partial<SketchConfig<CanvasState, UserConfig>> = {
  type: 'webgl2',
  userConfig,
  plugins: [tweakpanePlugin],
};

const vertexShader = glsl`#version 300 es

in vec4 a_position;

void main() {
  gl_Position = a_position;
}
`;

const fragmentShader = glsl`#version 300 es

precision mediump float;

uniform vec2 u_resolution;
uniform float u_timestamp;

out vec4 o_fragColor;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float time = u_timestamp * 0.001;

  float color = 0.0;
  // lifted from glslsandbox.com
  color += sin( uv.x * cos( time / 3.0 ) * 60.0 ) + cos( uv.y * cos( time / 2.80 ) * 10.0 );
  color += sin( uv.y * sin( time / 2.0 ) * 40.0 ) + cos( uv.x * sin( time / 1.70 ) * 40.0 );
  color += sin( uv.x * sin( time / 1.0 ) * 10.0 ) + sin( uv.y * sin( time / 3.50 ) * 80.0 );
  color *= sin( time / 10.0 ) * 0.5;

  o_fragColor = vec4( vec3( color * 0.5, sin( color + time / 2.5 ) * 0.75, color ), 1.0 );
}
`;

export const init: InitFn<CanvasState, UserConfig> = ({ gl2: gl }) => {
  if (!gl) throw new Error('???');

  const arrays = {
    a_position: [-1, -1, 0, 1, -1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1, 1, 0],
  };
  const bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays);

  const programInfo = twgl.createProgramInfo(gl, [
    vertexShader,
    fragmentShader,
  ]);

  const vao = twgl.createVertexArrayInfo(gl, programInfo, bufferInfo);

  return { programInfo, vao };
};

export const frame: FrameFn<CanvasState, UserConfig> = ({
  gl2: gl,
  state,
  width,
  height,
  timestamp,
  hasChanged,
}) => {
  if (!gl) throw new Error('???');

  if (hasChanged) {
    state.programInfo = twgl.createProgramInfo(gl, [
      vertexShader,
      fragmentShader,
    ]);
  }

  const { programInfo, vao } = state;

  const uniforms = {
    u_timestamp: timestamp,
    u_resolution: [width, height],
  };

  gl.useProgram(programInfo.program);
  twgl.setBuffersAndAttributes(gl, programInfo, vao);
  twgl.setUniforms(programInfo, uniforms);
  twgl.drawBufferInfo(gl, vao);
};
