import * as twgl from 'twgl.js';

import TweakpanePlugin from '@/utils/plugins/tweakpane';
import type { SketchConfig, InitFn, FrameFn } from '@/utils/renderers/vanilla';

export const meta = {
  name: 'WebGL tranform feedback experiment',
  date: '2023-03-15',
  tags: ['WebGL'],
};

const glsl = String.raw;

export interface CanvasState {
  programInfo: twgl.ProgramInfo;
  renderBufferInfo: twgl.BufferInfo;
  updateBufferInfo: twgl.BufferInfo;
  transformFeedback: ReturnType<typeof twgl.createTransformFeedbackInfo>;
}

const userConfig = {};
export type UserConfig = typeof userConfig;

const tweakpanePlugin = new TweakpanePlugin<CanvasState, UserConfig>();

export const sketchConfig: Partial<SketchConfig<CanvasState, UserConfig>> = {
  type: 'webgl2',
  userConfig,
  plugins: [tweakpanePlugin],
};

const vertexShader = glsl`#version 300 es

in float a_angle;
out float v_angle;

void main() {
  gl_PointSize = 20.0;

  float radius = 0.5;
  float x = radius * cos(a_angle);
  float y = radius * sin(a_angle);

  gl_Position = vec4(x, y, 0, 1);

  v_angle = a_angle + 0.02;
}
`;

const fragmentShader = glsl`#version 300 es
precision mediump float;

out vec4 fragColor;

void main() {
  fragColor = vec4(1.0);
}
`;

export const init: InitFn<CanvasState, UserConfig> = ({ gl2: gl }) => {
  if (!gl) throw new Error('???');

  const programInfo = twgl.createProgramInfo(
    gl,
    [vertexShader, fragmentShader],
    { transformFeedbackVaryings: ['v_angle'] }
  );

  const renderBufferInfo = twgl.createBufferInfoFromArrays(gl, {
    a_angle: {
      data: [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2],
      numComponents: 1,
      divisor: 1,
      // Types are incorrect: https://github.com/greggman/twgl.js/blob/2bd840a29c88050efa3dae9e2cc676bd7ca666be/src/attributes.js#L432
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      drawType: gl.DYNAMIC_COPY,
    },
  });
  const updateBufferInfo = twgl.createBufferInfoFromArrays(gl, {
    v_angle: {
      data: [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2],
      numComponents: 1,
      divisor: 1,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      drawType: gl.DYNAMIC_COPY,
    },
  });

  const transformFeedback = twgl.createTransformFeedbackInfo(
    gl,
    programInfo.program
  );

  return { programInfo, renderBufferInfo, updateBufferInfo, transformFeedback };
};

export const frame: FrameFn<CanvasState, UserConfig> = ({
  gl2: gl,
  state,
  hasChanged,
}) => {
  if (!gl) throw new Error('???');

  if (hasChanged) {
    state.programInfo = twgl.createProgramInfo(
      gl,
      [vertexShader, fragmentShader],
      { transformFeedbackVaryings: ['v_angle'] }
    );
  }

  const { programInfo, renderBufferInfo, updateBufferInfo, transformFeedback } =
    state;

  gl.useProgram(programInfo.program);

  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  twgl.setBuffersAndAttributes(gl, programInfo, renderBufferInfo);

  twgl.bindTransformFeedbackInfo(gl, transformFeedback, updateBufferInfo);
  gl.beginTransformFeedback(gl.POINTS);
  twgl.drawBufferInfo(
    gl,
    renderBufferInfo,
    gl.POINTS,
    1,
    0,
    renderBufferInfo.numElements
  );
  gl.endTransformFeedback();

  gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
  gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);

  if (!renderBufferInfo.attribs || !updateBufferInfo.attribs)
    throw new Error('???');
  const bufA = renderBufferInfo.attribs.a_angle.buffer;
  const bufB = updateBufferInfo.attribs.v_angle.buffer;
  renderBufferInfo.attribs.a_angle.buffer = bufB;
  updateBufferInfo.attribs.v_angle.buffer = bufA;
};
