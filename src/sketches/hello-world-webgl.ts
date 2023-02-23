import * as twgl from 'twgl.js';

import type { Config, InitFn, FrameFn } from '@/utils/renderers/vanilla';

export const meta = {
  name: 'Hello world (webgl)',
  date: '2023-02-13',
};

const glsl = String.raw;

export interface CanvasState {
  programInfo: twgl.ProgramInfo;
  bufferInfo: twgl.BufferInfo;
}

const sketchConfig = {
  var: 1,
};
export type SketchConfig = typeof sketchConfig;

export const sketchbookConfig: Partial<Config<CanvasState, SketchConfig>> = {
  type: 'webgl',
  sketchConfig,
};

const vertexShader = glsl`
attribute vec4 position;

void main() {
  gl_Position = position;
}
`;

const fragmentShader = glsl`
precision mediump float;

uniform vec2 resolution;
uniform float time;

void main() {
  vec2 uv = gl_FragCoord.xy / resolution;

  float color = 0.0;
  // lifted from glslsandbox.com
  color += sin( uv.x * cos( time / 3.0 ) * 60.0 ) + cos( uv.y * cos( time / 2.80 ) * 10.0 );
  color += sin( uv.y * sin( time / 2.0 ) * 40.0 ) + cos( uv.x * sin( time / 1.70 ) * 40.0 );
  color += sin( uv.x * sin( time / 1.0 ) * 10.0 ) + sin( uv.y * sin( time / 3.50 ) * 80.0 );
  color *= sin( time / 10.0 ) * 0.5;

  gl_FragColor = vec4( vec3( color * 0.5, sin( color + time / 2.5 ) * 0.75, color ), 1.0 );
}
`;

export const init: InitFn<CanvasState, SketchConfig> = ({ gl }) => {
  if (!gl) throw new Error('???');

  const programInfo = twgl.createProgramInfo(gl, [
    vertexShader,
    fragmentShader,
  ]);

  const arrays = {
    position: [-1, -1, 0, 1, -1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1, 1, 0],
  };
  const bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays);

  return { programInfo, bufferInfo };
};

export const frame: FrameFn<CanvasState, SketchConfig> = ({
  gl,
  state,
  width,
  height,
  timestamp,
}) => {
  if (!gl) throw new Error('???');
  const { programInfo, bufferInfo } = state;

  const uniforms = {
    time: timestamp * 0.001,
    resolution: [width, height],
  };

  gl.useProgram(programInfo.program);
  twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo);
  twgl.setUniforms(programInfo, uniforms);
  twgl.drawBufferInfo(gl, bufferInfo);
};
