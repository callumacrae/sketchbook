import * as twgl from 'twgl.js';
import snoise from 'lygia/generative/snoise.glsl';

import * as random from '@/utils/random';
import TweakpanePlugin from '@/utils/plugins/tweakpane';
import type { SketchConfig, InitFn, FrameFn } from '@/utils/renderers/vanilla';

export const meta = {
  name: 'Flow field doughnut 2D (webgl)',
  date: '2023-03-19',
  tags: ['WebGL', 'Particles', 'Flow field'],
};

const glsl = String.raw;

export interface CanvasState {
  programInfo: twgl.ProgramInfo;
  renderBufferInfo: twgl.BufferInfo;
  updateBufferInfo: twgl.BufferInfo;
  transformFeedback: ReturnType<typeof twgl.createTransformFeedbackInfo>;
}

const userConfig = {
  particles: 2000,
  debugArrows: false,
  resolution: 30,
  variance: 0.6,
  noiseInPosFactor: 10,
  noiseInTimeFactor: 0.0008,
  velocity: 0.01,
  acceleration: 0.2,
  lookAhead: 5,
};
export type UserConfig = typeof userConfig;

const tweakpanePlugin = new TweakpanePlugin<CanvasState, UserConfig>(
  ({ pane, config }) => {
    pane.addInput(config, 'particles', { min: 1, max: 1000, step: 1 });
    pane.addInput(config, 'debugArrows');
    pane.addInput(config, 'resolution', { min: 10, max: 100 });
    pane.addInput(config, 'variance', { min: 0, max: Math.PI });
    pane.addInput(config, 'noiseInPosFactor', { min: 0, max: 20 });
    pane.addInput(config, 'noiseInTimeFactor', { min: 0, max: 0.001 });
    pane.addInput(config, 'velocity', { min: 0, max: 1 });
    pane.addInput(config, 'acceleration', { min: 0, max: 1 });
    pane.addInput(config, 'lookAhead', { min: 0, max: 20 });
  }
);

export const sketchConfig: Partial<SketchConfig<CanvasState, UserConfig>> = {
  type: 'webgl2',
  userConfig,
  plugins: [tweakpanePlugin],
};

export const vertexShader = glsl`#version 300 es

#define PI 3.141592653589793

${snoise}

uniform float u_timestamp;
uniform float u_variance;
uniform float u_noiseInPosFactor;
uniform float u_noiseInTimeFactor;
uniform float u_velocity;
uniform float u_acceleration;
uniform float u_lookAhead;

in vec2 a_position;
in vec2 a_velocity;

out vec2 v_position;
out vec2 v_velocity;

float angleForCoords(vec2 coords) {
  float perfectAngle = atan(coords.y, coords.x) - 0.5 * PI;

  // This ensures that the field never points out of the circle
  float angleOffset =
    (u_variance / 2.0) *
    (0.5 - (length(coords) - 0.2) / (0.8 - 0.2));

  float noise = snoise(vec3(
    coords * u_noiseInPosFactor,
    u_timestamp * u_noiseInTimeFactor
  )) * u_variance / 2.0;

  return perfectAngle + angleOffset + noise;
}

void main() {
  vec2 aheadPosition = a_position + a_velocity * u_lookAhead;
  float aheadPositionAngle = angleForCoords(aheadPosition);
  vec2 idealVelocity = vec2(
    cos(aheadPositionAngle),
    sin(aheadPositionAngle)
  ) * u_velocity;

  vec2 newVelocity = mix(a_velocity, idealVelocity, u_acceleration);
  vec2 newPosition = a_position + newVelocity;

  gl_PointSize = 5.0;
  gl_Position = vec4(newPosition, 0.0, 1.0);

  v_position = newPosition;
  v_velocity = newVelocity;
}
`;

export const fragmentShader = glsl`#version 300 es

precision mediump float;

out vec4 o_fragColor;

void main() {
  o_fragColor = vec4(1.0);
}
`;

export const init: InitFn<CanvasState, UserConfig> = (props) => {
  const { gl2: gl, userConfig } = props;
  if (!gl) throw new Error('???');

  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  const particleCount = userConfig.particles;
  const particlePositionsArray = new Float32Array(particleCount * 2);
  const particleVelocitiesArray = new Float32Array(particleCount * 2);

  for (let i = 0; i < particleCount; i++) {
    particlePositionsArray[i * 2] = random.range(-1, 1);
    particlePositionsArray[i * 2 + 1] = random.range(-1, 1);
    particleVelocitiesArray[i * 2] = 0;
    particleVelocitiesArray[i * 2 + 1] = 0;
  }

  const renderBufferInfo = twgl.createBufferInfoFromArrays(gl, {
    a_position: {
      numComponents: 2,
      data: particlePositionsArray,
      divisor: 1,
      drawType: gl.DYNAMIC_COPY,
    } as twgl.FullArraySpec,
    a_velocity: {
      numComponents: 2,
      data: particleVelocitiesArray,
      divisor: 1,
      drawType: gl.DYNAMIC_COPY,
    } as twgl.FullArraySpec,
  });
  const updateBufferInfo = twgl.createBufferInfoFromArrays(gl, {
    v_position: {
      numComponents: 2,
      data: new Float32Array(particlePositionsArray.length),
      divisor: 1,
      drawType: gl.DYNAMIC_COPY,
    } as twgl.FullArraySpec,
    v_velocity: {
      numComponents: 2,
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

  return {
    programInfo,
    renderBufferInfo,
    updateBufferInfo,
    transformFeedback,
  };
};

export const frame: FrameFn<CanvasState, UserConfig> = (props) => {
  const { gl2: gl, state, width, height, hasChanged, delta, timestamp, userConfig } = props;
  if (!gl) throw new Error('???');

  const { programInfo, renderBufferInfo, updateBufferInfo, transformFeedback } =
    state;

  if (hasChanged) {
    state.programInfo = twgl.createProgramInfo(
      gl,
      [vertexShader, fragmentShader],
      { transformFeedbackVaryings: updateBufferInfo }
    );
  }

  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(programInfo.program);

  twgl.setBuffersAndAttributes(gl, programInfo, renderBufferInfo);
  twgl.setUniforms(programInfo, {
    u_delta: delta,
    u_timestamp: timestamp,
    u_resolution: [width, height],
    u_variance: userConfig.variance,
    u_noiseInPosFactor: userConfig.noiseInPosFactor,
    u_noiseInTimeFactor: userConfig.noiseInTimeFactor,
    u_velocity: userConfig.velocity,
    u_acceleration: userConfig.acceleration,
    u_lookAhead: userConfig.lookAhead,
  });

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
  const positionBufferA = renderBufferInfo.attribs.a_position.buffer;
  const positionBufferB = updateBufferInfo.attribs.v_position.buffer;
  renderBufferInfo.attribs.a_position.buffer = positionBufferB;
  updateBufferInfo.attribs.v_position.buffer = positionBufferA;
  const velocityBufferA = renderBufferInfo.attribs.a_velocity.buffer;
  const velocityBufferB = updateBufferInfo.attribs.v_velocity.buffer;
  renderBufferInfo.attribs.a_velocity.buffer = velocityBufferB;
  updateBufferInfo.attribs.v_velocity.buffer = velocityBufferA;
};
