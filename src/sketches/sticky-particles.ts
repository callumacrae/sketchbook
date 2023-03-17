import * as twgl from 'twgl.js';
import { easePolyIn, easePolyInOut } from 'd3-ease';
import BezierEasing from 'bezier-easing';

import NoiseMachine, {
  BandedNoiseGenerator,
  CustomNoiseGenerator,
  SimplexNoiseGenerator,
} from '@/utils/noise';
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
  addChanceNoiseMachine: NoiseMachine;
  accelerationNoiseMachine: NoiseMachine;
  programInfo: twgl.ProgramInfo;
  renderBufferInfo: twgl.BufferInfo;
  updateBufferInfo: twgl.BufferInfo;
  transformFeedback: ReturnType<typeof twgl.createTransformFeedbackInfo>;
  backgroundTexture: WebGLTexture;
}

let urlText = new URLSearchParams(window.location.search).get('text');
const userConfig = {
  text: urlText || 'Hello world',
  textSize: 30,

  particles: {
    count: 20000,
    size: 6,
    sizeVariance: 3,
    accelerationFactor: 1,
    stuckSpeedFactor: 1,
    addChanceFactor: 10,
  },

  colors: {
    // https://colorhunt.co/palette/08d9d6252a34ff2e63eaeaea
    background: { r: 37 / 256, g: 42 / 256, b: 52 / 256 },
    particles: { r: 8 / 256, g: 217 / 256, b: 214 / 256 },
  },
};
export type UserConfig = typeof userConfig;

const tweakpanePlugin = new TweakpanePlugin<CanvasState, UserConfig>(
  ({ config, pane }) => {
    pane.addInput(config, 'text');
    pane.addInput(config, 'textSize', { min: 5, max: 100 });

    const particleFolder = pane.addFolder({ title: 'Particles' });
    // particleFolder.addInput(config.particles, 'count', { min: 1000, max: 100000 });
    particleFolder.addInput(config.particles, 'size', { min: 1, max: 20 });
    particleFolder.addInput(config.particles, 'sizeVariance', {
      min: 0,
      max: 10,
    });
    particleFolder.addInput(config.particles, 'accelerationFactor', {
      min: 0,
      max: 5,
    });
    particleFolder.addInput(config.particles, 'stuckSpeedFactor', {
      min: 0,
      max: 4,
    });
    particleFolder.addInput(config.particles, 'addChanceFactor', {
      min: 0,
      max: 20,
    });

    const colorsFolder = pane.addFolder({ title: 'Colors' });
    colorsFolder.addInput(config.colors, 'background', {
      color: { type: 'float' },
    });
    colorsFolder.addInput(config.colors, 'particles', {
      color: { type: 'float' },
    });
  }
);

export const sketchConfig: Partial<SketchConfig<CanvasState, UserConfig>> = {
  type: 'webgl2',
  userConfig,
  plugins: [tweakpanePlugin],
};

export function initBackground({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  const canvasWidth = width / 16;
  const canvasHeight = height / 16;

  return doWorkOffscreen(canvasWidth, canvasHeight, (ctx) => {
    // TODO: pass userConfig into function, don't use global
    const { text, textSize } = userConfig;

    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    ctx.fillStyle = 'white';
    ctx.font = `100 ${textSize}px sans-serif`;
    ctx.textAlign = 'center';

    const textHeight = ctx.measureText(text).actualBoundingBoxAscent;
    ctx.fillText(text, canvasWidth / 2, canvasHeight / 2 + textHeight / 2);
  });
}

export function initAddChanceNoiseMachine() {
  const noiseMachine = new NoiseMachine();

  const generalNoiseFactor = 0.05;
  const fastNoise = new SimplexNoiseGenerator({
    inputFactor: 0.001,
    range: [0, 1],
  });
  const slowNoise = new SimplexNoiseGenerator({
    inputFactor: 0.00005,
    range: [0, generalNoiseFactor],
    factor: fastNoise,
  });
  noiseMachine.add(slowNoise);

  const bandedNoiseGenerator = new BandedNoiseGenerator({
    bandFreqency: new SimplexNoiseGenerator({
      inputFactor: 0.00001,
      range: [200, 250],
    }),
    bandSize: 50,
    factor: new SimplexNoiseGenerator({
      inputFactor: 0.001,
      range: [0, 1],
      factor(x) {
        const slowNoiseOut = slowNoise.get(x);
        return (
          0.2 + ((generalNoiseFactor - slowNoiseOut) / generalNoiseFactor) * 0.6
        );
      },
      easing: easePolyIn.exponent(5),
    }),
    easing: easePolyInOut.exponent(3),
  });
  noiseMachine.add(bandedNoiseGenerator);

  const occasionalHeavyNoise = new CustomNoiseGenerator(() => {
    return random.chance(0.007) ? 100000 : 0;
  });
  noiseMachine.add(occasionalHeavyNoise);

  return noiseMachine;
}

export function initAccelerationNoiseMachine() {
  const noiseMachine = new NoiseMachine();

  const extremeNoise = new SimplexNoiseGenerator({
    inputFactor: 0.0003,
    easing: BezierEasing(.17,.13,0,1.03),
    factor: -0.001,
  });
  noiseMachine.add(extremeNoise);

  return noiseMachine;
}

export const vertexShader = glsl`#version 300 es

#define PI 3.141592653589793

uniform float u_delta;
uniform float u_particleAcceleration;
uniform float u_particleSize;
uniform sampler2D u_backgroundTexture;
uniform float u_particleAddChance;
uniform float u_particleSizeVariance;
uniform float u_particleStuckSpeedFactor;

in vec2 a_particlePosition;
in float a_particleVelocity;
in float a_particleRandSeed;
in float a_particleSizeVariance;

out vec2 v_particlePosition;
out float v_particleVelocity;

/** VENDOR START **/
// http://byteblacksmith.com/improvements-to-the-canonical-one-liner-glsl-rand-for-opengl-es-2-0/
highp float rand( const in vec2 uv ) {
  const highp float a = 12.9898, b = 78.233, c = 43758.5453;
  highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
  return fract( sin( sn ) * c );
}
/** VENDOR END **/

void main() {
  float deltaAdjust = u_delta / 16.666;
  float newVelocity = a_particleVelocity + u_particleAcceleration * deltaAdjust;

  float resistance = texture(u_backgroundTexture, a_particlePosition / 2.0 + 0.5).r;
  if (resistance > 0.5) {
    newVelocity = u_particleAcceleration * u_particleStuckSpeedFactor;
  }

  // This is mostly for when particles have gone off screen to avoid any
  // huge numbers
  if (newVelocity > 0.5) {
    newVelocity = 0.5;
  }

  vec2 newPosition = a_particlePosition + vec2(0.0, newVelocity) * deltaAdjust;
  bool offScreen = newPosition.y < -1.0 || newPosition.y > 1.0;

  if (offScreen) {
    float randChance = 0.0;
    bool addParticle = false;
    if (u_particleAddChance > 1000.0) {
      float randChance2 = rand(vec2(fract(newPosition.y), a_particleRandSeed));
      addParticle = randChance2 < 0.03;
    } else {
      // For some reason just one of them would be 0.0 far too often
      randChance = rand(vec2(a_particleRandSeed, fract(newPosition.y)));
      float randChance2 = rand(vec2(fract(newPosition.y), a_particleRandSeed));
      addParticle = randChance + randChance2 < u_particleAddChance * deltaAdjust;
    }

    if (addParticle) {
      newPosition.x = rand(vec2(newPosition.x, a_particleRandSeed)) * 2.0 - 1.0;
      if (u_particleAcceleration < 0.0) {
        newPosition.y = 1.0 + randChance / 10.0;
      } else {
        newPosition.y = -1.0 - randChance / 10.0;
      }
      newVelocity = 0.0;

    // We store pixels between 2 and 3 (or -2 and -3) so that they don't come
    // back on screen if acceleration changes
    } else if (newPosition.y < -1.0 && newPosition.y > -2.0) {
      newPosition.y -= 1.0;
    } else if (newPosition.y > 1.0 && newPosition.y < 2.0) {
      newPosition.y += 1.0;
    } else if (newPosition.y < -3.0) {
      newPosition.y += 1.0;
    } else if (newPosition.y > 3.0) {
      newPosition.y -= 1.0;
    }
  }

  gl_PointSize = u_particleSize + (a_particleSizeVariance * u_particleSizeVariance);
  gl_Position = vec4(newPosition, 0.0, 1.0);

  v_particlePosition = newPosition;
  v_particleVelocity = newVelocity;
}
`;

export const fragmentShader = glsl`#version 300 es

precision mediump float;

uniform vec3 u_particleColor;

out vec4 o_fragColor;

void main() {
  o_fragColor = vec4(u_particleColor, 1.0);
}
`;

export const init: InitFn<CanvasState, UserConfig> = (props) => {
  const { gl2: gl } = props;
  if (!gl) throw new Error('???');

  if (urlText) {
    userConfig.text = urlText;
    tweakpanePlugin.refresh();
    urlText = null;
  }

  twgl.addExtensionsToContext(gl);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  const particleCount = userConfig.particles.count;
  const particlePositionsArray = new Float32Array(particleCount * 2);
  const particleVelocitiesArray = new Float32Array(particleCount);
  const particleRandSeedsArray = new Float32Array(particleCount);
  const particleSizeVariancesArray = new Float32Array(particleCount);

  for (let i = 0; i < particleCount; i++) {
    particlePositionsArray[i * 2] = random.range(-1, 1);
    particlePositionsArray[i * 2 + 1] = -1.1;
    particleVelocitiesArray[i] = 0;
    particleRandSeedsArray[i] = random.range(-1, 1);
    particleSizeVariancesArray[i] = random.range(-0.5, 0.5);
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
    a_particleRandSeed: {
      numComponents: 1,
      data: particleRandSeedsArray,
      divisor: 1,
    },
    a_particleSizeVariance: {
      numComponents: 1,
      data: particleSizeVariancesArray,
      divisor: 1,
    },
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
    addChanceNoiseMachine: initAddChanceNoiseMachine(),
    accelerationNoiseMachine: initAccelerationNoiseMachine(),
    programInfo,
    renderBufferInfo,
    updateBufferInfo,
    transformFeedback,
    backgroundTexture,
  };
};

export const frame: FrameFn<CanvasState, UserConfig> = (props) => {
  const { gl2: gl, state, delta, timestamp, hasChanged } = props;
  if (!gl) throw new Error('???');

  if (hasChanged) {
    // TODO: handle this
    if (userConfig.particles.count !== state.renderBufferInfo.numElements) {
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

    state.addChanceNoiseMachine = initAddChanceNoiseMachine();
    state.accelerationNoiseMachine = initAccelerationNoiseMachine();
  }

  const {
    addChanceNoiseMachine,
    accelerationNoiseMachine,
    programInfo,
    renderBufferInfo,
    updateBufferInfo,
    transformFeedback,
  } = state;

  const addChance = addChanceNoiseMachine.get(timestamp);
  const acceleration = accelerationNoiseMachine.get(timestamp);

  const { background: bgColor, particles: particleColor } = userConfig.colors;
  gl.clearColor(bgColor.r, bgColor.g, bgColor.b, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  const uniforms = {
    u_delta: delta,
    u_particleAcceleration:
      userConfig.particles.accelerationFactor * acceleration,
    u_particleSize: userConfig.particles.size,
    u_particleColor: [particleColor.r, particleColor.g, particleColor.b],
    u_backgroundTexture: state.backgroundTexture,
    u_particleAddChance: addChance * userConfig.particles.addChanceFactor,
    u_particleSizeVariance: userConfig.particles.sizeVariance,
    u_particleStuckSpeedFactor: userConfig.particles.stuckSpeedFactor,
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
