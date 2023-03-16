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
  renderBufferInfo: twgl.BufferInfo;
  updateBufferInfo: twgl.BufferInfo;
  transformFeedback: ReturnType<typeof twgl.createTransformFeedbackInfo>;
  backgroundTexture: WebGLTexture;
}

const userConfig = {
  particles: 10000,
  particleSize: 5,
  particleAcceleration: 0.0001,

  // https://colorhunt.co/palette/2d27274135438f43eef0eb8d
  bgColor: { r: 45 / 256, g: 39 / 256, b: 39 / 256 },
  particleColor: { r: 240 / 256, g: 235 / 256, b: 141 / 256 },
};
export type UserConfig = typeof userConfig;

const tweakpanePlugin = new TweakpanePlugin<CanvasState, UserConfig>(({ config, pane }) => {
  // pane.addInput(config, 'particles', { min: 1000, max: 100000 });
  pane.addInput(config, 'particleSize', { min: 1, max: 20 });
  pane.addInput(config, 'particleAcceleration', { min: 0.00001, max: 0.001 });
  pane.addInput(config, 'bgColor', { color: { type: 'float' }});
  pane.addInput(config, 'particleColor', { color: { type: 'float' }});
});

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

uniform float u_delta;
uniform float u_particleAcceleration;
uniform float u_particleSize;
uniform sampler2D u_backgroundTexture;

in vec2 a_particlePosition;
in float a_particleVelocity;
out vec2 v_particlePosition;
out float v_particleVelocity;

out float v_color;

void main() {
  float newVelocity = a_particleVelocity + u_particleAcceleration / 16.666 * u_delta;
  vec2 newPosition = a_particlePosition - vec2(0.0, newVelocity);
  if (newPosition.y < -1.0) {
    newPosition.y = 1.0;
    newVelocity = 0.0;
  }

  gl_PointSize = u_particleSize;
  gl_Position = vec4(newPosition, 0.0, 1.0);

  v_color = texture(u_backgroundTexture, a_particlePosition / 2.0 + 0.5).r;

  v_particlePosition = newPosition;
  v_particleVelocity = newVelocity;
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

  const particlePositionsArray = new Float32Array(userConfig.particles * 2);
  const particleVelocitiesArray = new Float32Array(userConfig.particles);

  for (let i = 0; i < userConfig.particles; i++) {
    particlePositionsArray[i * 2] = random.range(-1, 1);
    particlePositionsArray[i * 2 + 1] = random.range(3, 1);
    particleVelocitiesArray[i] = 0;
  }

  const renderBufferInfo = twgl.createBufferInfoFromArrays(gl, {
    a_particlePosition: {
      numComponents: 2,
      data: particlePositionsArray,
      divisor: 1,
      drawType: gl.DYNAMIC_COPY,
    } as twgl.FullArraySpec,
    a_particleVelocity: {
      numComponents: 1,
      data: particleVelocitiesArray,
      divisor: 1,
      drawType: gl.DYNAMIC_COPY,
    } as twgl.FullArraySpec,
  });
  const updateBufferInfo = twgl.createBufferInfoFromArrays(gl, {
    v_particlePosition: {
      numComponents: 2,
      data: new Float32Array(particlePositionsArray.length),
      divisor: 1,
      drawType: gl.DYNAMIC_COPY,
    } as twgl.FullArraySpec,
    v_particleVelocity: {
      numComponents: 1,
      data: new Float32Array(particleVelocitiesArray.length),
      divisor: 1,
      drawType: gl.DYNAMIC_COPY,
    } as twgl.FullArraySpec,
  });

  const programInfo = twgl.createProgramInfo(
    gl,
    [vertexShader, fragmentShader],
    { transformFeedbackVaryings: updateBufferInfo }
  );

  const transformFeedback = twgl.createTransformFeedbackInfo(
    gl,
    programInfo.program
  );

  const backgroundTexture = twgl.createTexture(gl, {
    src: initBackground(props),
  });

  return {
    programInfo,
    renderBufferInfo,
    updateBufferInfo,
    transformFeedback,
    backgroundTexture,
  };
};

export const frame: FrameFn<CanvasState, UserConfig> = (props) => {
  const { gl2: gl, state, delta, hasChanged } = props;
  if (!gl) throw new Error('???');

  if (hasChanged) {
    // TODO: handle this
    if (userConfig.particles !== state.renderBufferInfo.numElements) {
      window.location.reload();
    }

    state.programInfo = twgl.createProgramInfo(
      gl,
      [vertexShader, fragmentShader],
      { transformFeedbackVaryings: state.updateBufferInfo }
    );

    state.backgroundTexture = twgl.createTexture(gl, {
      src: initBackground(props),
    });
  }

  const { programInfo, renderBufferInfo, updateBufferInfo, transformFeedback } =
    state;

  const { bgColor, particleColor } = userConfig;
  gl.clearColor(bgColor.r, bgColor.g, bgColor.b, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  const uniforms = {
    u_delta: delta,
    u_particleAcceleration: userConfig.particleAcceleration,
    u_particleSize: userConfig.particleSize,
    u_particleColor: [particleColor.r, particleColor.g, particleColor.b],
    u_backgroundTexture: state.backgroundTexture,
  };

  gl.useProgram(programInfo.program);

  twgl.setBuffersAndAttributes(gl, programInfo, renderBufferInfo);
  twgl.setUniforms(programInfo, uniforms);

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
  const positionBufferA = renderBufferInfo.attribs.a_particlePosition.buffer;
  const positionBufferB = updateBufferInfo.attribs.v_particlePosition.buffer;
  renderBufferInfo.attribs.a_particlePosition.buffer = positionBufferB;
  updateBufferInfo.attribs.v_particlePosition.buffer = positionBufferA;
  const velocityBufferA = renderBufferInfo.attribs.a_particleVelocity.buffer;
  const velocityBufferB = updateBufferInfo.attribs.v_particleVelocity.buffer;
  renderBufferInfo.attribs.a_particleVelocity.buffer = velocityBufferB;
  updateBufferInfo.attribs.v_particleVelocity.buffer = velocityBufferA;
};
