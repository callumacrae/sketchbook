import * as twgl from 'twgl.js';

import { doWorkOffscreen } from '@/utils/canvas/utils';
import * as random from '@/utils/random';
import TweakpanePlugin from '@/utils/plugins/tweakpane';
import type {
  LightningWorkerMessageIn,
  LightningWorkerMessageOut,
} from '@/utils/workers/generate-lightning';
import type { SketchConfig, InitFn, FrameFn } from '@/utils/renderers/vanilla';

export const meta = {
  name: 'Storm chars 2',
  date: '2023-02-13',
  tags: ['WebGL', 'TWGL.js', 'Generative art', 'Slow'],
  favourite: true,
  codepen: 'https://codepen.io/callumacrae/full/YzOPqNz',
};

const glsl = String.raw;

interface LightningState {
  texture: WebGLTexture;
  width: number;
  height: number;
  strikeAt: number[];
}

interface CanvasState {
  lightningCharge: number;
  lightningId: number;
  lightning: LightningState[];
  lightningRequested: boolean;
  programInfo: twgl.ProgramInfo;
  bufferInfo: twgl.BufferInfo;
  charsTexture: WebGLTexture;
  lightningWorker: Worker;
  resetAfter?: number;
}

const userConfig = {
  maxWidth: 5,
  preload: 3,
  visualisation: {
    chars: '.,;*^/\\oOxX',
    charSize: window.devicePixelRatio > 1 ? 15 : 8,
    lighten: 0.5,
    randomness: 0.8,
  },
  animation: {
    fadeTime: 150,
    frequencyFactor: 0.7,
  },
  branch: {
    factor: 0.02,
    factorWithDepth: 0.03,
    angle: { min: 0.2786896709, max: 1.216100382 },
    biasExponent: 0.42,
  },
  wobble: {
    segmentLength: 5,
    biasToPerfect: 0.66,
    biasToPerfectVariance: 0.38,
    randomFactor: 2,
  },
  bloom: {
    enabled: true,
    passes: 3,
    strength: 1.5,
    radius: 0.75,
  },
};
type UserConfig = typeof userConfig;

const tweakpanePlugin = new TweakpanePlugin<CanvasState, UserConfig>(
  ({ pane, config }) => {
    const visFolder = pane.addFolder({ title: 'Visualisation' });
    visFolder.addInput(config.visualisation, 'charSize', { min: 1, max: 100 });
    visFolder.addInput(config.visualisation, 'lighten', { min: 0, max: 1 });
    visFolder.addInput(config.visualisation, 'randomness', { min: 0, max: 1 });

    const animFolder = pane.addFolder({ title: 'Animation' });
    animFolder.addInput(config.animation, 'fadeTime', { min: 0, max: 1000 });
    animFolder.addInput(config.animation, 'frequencyFactor', {
      min: -1,
      max: 2,
    });

    const branchFolder = pane.addFolder({ title: 'Lightning branching' });
    branchFolder.addInput(config.branch, 'factor', { min: 0, max: 0.2 });
    branchFolder.addInput(config.branch, 'factorWithDepth', {
      min: -0.2,
      max: 0.2,
    });
    branchFolder.addInput(config.branch, 'angle', { min: 0, max: Math.PI / 2 });
    branchFolder.addInput(config.branch, 'biasExponent', { min: 0.1, max: 10 });

    const wobbleFolder = pane.addFolder({ title: 'Lightning wobble' });
    wobbleFolder.addInput(config.wobble, 'segmentLength', { min: 0, max: 100 });
    wobbleFolder.addInput(config.wobble, 'biasToPerfect', { min: 0, max: 1 });
    wobbleFolder.addInput(config.wobble, 'biasToPerfectVariance', {
      min: 0,
      max: 0.5,
    });
    wobbleFolder.addInput(config.wobble, 'randomFactor', { min: 0, max: 15 });

    const bloomFolder = pane.addFolder({ title: 'Lightning Bloom' });
    bloomFolder.addInput(config.bloom, 'enabled');
    bloomFolder.addInput(config.bloom, 'passes', { min: 0, max: 15 });
    bloomFolder.addInput(config.bloom, 'strength', { min: 0, max: 15 });
    bloomFolder.addInput(config.bloom, 'radius', { min: 0, max: 5 });
  }
);

export const sketchConfig: Partial<SketchConfig<CanvasState, UserConfig>> = {
  type: 'webgl',
  showLoading: true,
  userConfig,
  plugins: [tweakpanePlugin],
};

async function initCharsCanvas({
  userConfig: config,
  sketchConfig,
}: {
  userConfig: UserConfig;
  sketchConfig: SketchConfig<CanvasState, UserConfig>;
  [key: string]: any;
}) {
  const font = new FontFace(
    'PublicPixel',
    'url(/public_pixel/PublicPixel.ttf)'
  );
  await font.load();
  document.fonts.add(font);

  const shrinkFactor = sketchConfig.isPreview ? 0.5 : 1;
  const { chars, charSize } = config.visualisation;
  const width = charSize * shrinkFactor * chars.length;
  const height = charSize * shrinkFactor;
  return doWorkOffscreen(width, height, (ctx) => {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, width, height);

    ctx.font = `${charSize * shrinkFactor * 0.75}px PublicPixel`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'white';

    for (let i = 0; i < chars.length; i++) {
      ctx.fillText(chars[i], (i + 0.5) * charSize * shrinkFactor, height / 2);
    }
  });
}

function requestLightning(props: {
  width: number;
  height: number;
  userConfig: UserConfig;
  sketchConfig: SketchConfig<CanvasState, UserConfig>;
  state: CanvasState;
  [key: string]: any;
}) {
  const { width, height, userConfig: config, state } = props;
  const isPreview = props.sketchConfig.isPreview;

  state.lightningRequested = true;

  const generateMessage: LightningWorkerMessageIn = {
    type: 'generate',
    props: {
      width,
      height,
      config: {
        maxWidth: isPreview ? 2 : config.maxWidth,
        visualisation: {
          ...config.visualisation,
          charSize: config.visualisation.charSize * (isPreview ? 0.5 : 1),
        },
        branch: {
          ...config.branch,
          ...(isPreview ? { factor: 0.04, factorWithDepth: 0.06 } : {}),
        },
        wobble: config.wobble,
        bloom: config.bloom,
        origin: 'random',
      },
    },
  };
  props.state.lightningWorker.postMessage(generateMessage);
}

const vertexShader = glsl`
attribute vec4 position;

void main() {
  gl_Position = position;
}
`;

const fragmentShader = glsl`
#define PI 3.141592653589793

precision mediump float;

uniform float charSize;
uniform float charsAvailable;
uniform float lightenFactor;
uniform float timestamp;
uniform float randomness;
uniform vec2 resolution;
uniform sampler2D chars;
uniform sampler2D lightning;
uniform float lightningAt;
uniform float fadeTime;

/** VENDOR START **/
// http://byteblacksmith.com/improvements-to-the-canonical-one-liner-glsl-rand-for-opengl-es-2-0/
highp float rand( const in vec2 uv ) {
  const highp float a = 12.9898, b = 78.233, c = 43758.5453;
  highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
  return fract( sin( sn ) * c );
}
/** VENDOR END **/

float luminosityToChar(float l) {
  float adjustedL = l < 0.5
    ? l * 2.0 * lightenFactor
    : 1.0 - (1.0 - l) * 2.0 * (1.0 - lightenFactor);

  if (adjustedL < 0.1) return 0.0;
  if (adjustedL < 0.18) return 1.0;
  if (adjustedL < 0.24) return 2.0;
  if (adjustedL < 0.3) return 3.0;
  if (adjustedL < 0.5) return 4.0;
  if (adjustedL < 0.55) return 5.0;
  if (adjustedL < 0.6) return 6.0;
  if (adjustedL < 0.87) return 7.0;
  if (adjustedL < 0.9) return 8.0;
  if (adjustedL < 0.98) return 9.0;
  return 10.0;
}

void main() {
  // uv coords are banded to the nearest character
  vec2 uv = floor(gl_FragCoord.xy / charSize) / resolution * charSize;
  float luminosity = texture2D(lightning, uv).r;

  float lightningAge = timestamp - lightningAt;
  luminosity *= max(1.0 - lightningAge / fadeTime, 0.0);

  float r = rand(fract(uv + timestamp / 123.45)) * (1.0 - (1.0 - randomness) * 0.05);
  if (r > 0.99) {
    luminosity += 0.5;
  } else if (r > 0.96) {
    luminosity += 0.15;
  }

  float charIndex = luminosityToChar(luminosity);

  vec2 uvInChar = fract(gl_FragCoord.xy / charSize);
  uvInChar.x = (uvInChar.x + charIndex) / charsAvailable;

  vec4 charColor = texture2D(chars, uvInChar);
  gl_FragColor = charColor;
}
`;

export const init: InitFn<CanvasState, UserConfig> = async (props) => {
  const {
    testSupport,
    gl,
    timestamp,
    userConfig: config,
    sketchConfig,
  } = props;
  const isPreview = sketchConfig.isPreview;
  if (!config || !gl) throw new Error('???');

  testSupport(() => {
    if (!('OffscreenCanvas' in window)) {
      return 'This sketch requires OffscreenCanvas';
    }
    return true;
  });

  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  const programInfo = twgl.createProgramInfo(gl, [
    vertexShader,
    fragmentShader,
  ]);

  const arrays = {
    position: {
      numComponents: 2,
      data: [-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1],
    },
  };
  const bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays);

  const charsTexture = twgl.createTexture(gl, {
    src: await initCharsCanvas(props),
    mag: gl.NEAREST,
  });

  const lightningWorker = new Worker(
    new URL('@/utils/workers/generate-lightning', import.meta.url),
    {
      type: 'module',
    }
  );

  const lightning: CanvasState['lightning'] = [];

  // Used to resolve the loading timer
  let loadingStateResolver: null | (() => void) = null;

  lightningWorker.onmessage = (e: MessageEvent<LightningWorkerMessageOut>) => {
    if (lightning.length > 10) {
      let mostStrikesIndex = -1;
      for (let i = 0; i < lightning.length; i++) {
        if (
          mostStrikesIndex === -1 ||
          lightning[i].strikeAt.length >
            lightning[mostStrikesIndex].strikeAt.length
        ) {
          mostStrikesIndex = i;
        }
      }

      if (mostStrikesIndex !== -1) {
        lightning.splice(mostStrikesIndex, 1);
      }
    }

    lightning.push({
      width: e.data.width,
      height: e.data.height,
      texture: twgl.createTexture(gl, {
        src: e.data.data,
        format: gl.LUMINANCE,
        width: e.data.width,
        height: e.data.height,
        mag: gl.NEAREST,
      }),
      strikeAt: [],
    });
    state.lightningRequested = false;

    if (
      loadingStateResolver &&
      lightning.length >= (isPreview ? 1 : config.preload)
    ) {
      loadingStateResolver();
    }
  };

  const state: CanvasState = {
    lightningCharge: 10000,
    lightningId: 0,
    lightning,
    lightningRequested: true,
    programInfo,
    bufferInfo,
    charsTexture,
    lightningWorker,
  };

  for (let i = 0; i < (isPreview ? 1 : config.preload); i++) {
    requestLightning({ ...props, state });
  }

  // Pre-generate lightning for up to one second
  await new Promise<void>((resolve, reject) => {
    loadingStateResolver = () => {
      resolve();
      loadingStateResolver = null;
    };
    setTimeout(
      () => {
        if (lightning.length) {
          if (loadingStateResolver) {
            loadingStateResolver();
          }
        } else {
          reject(new Error('Failed to generate lightning'));
        }
      },
      isPreview ? 2000 : 1000
    );
  });

  lightning[0].strikeAt.push(timestamp);

  return state;
};

export const frame: FrameFn<CanvasState, UserConfig> = async (props) => {
  const {
    gl,
    width,
    height,
    timestamp,
    delta,
    userConfig: config,
    state,
    hasChanged,
    sketchConfig,
  } = props;
  if (!gl) throw new Error('???');
  const { programInfo, bufferInfo } = state;
  const isPreview = sketchConfig.isPreview;

  const shrinkFactor = isPreview ? 0.5 : 1;
  const { charSize } = config.visualisation;
  const cols = Math.floor(width / (charSize * shrinkFactor));
  const rows = Math.floor(height / (charSize * shrinkFactor));

  if (hasChanged) {
    const charsCanvas = await initCharsCanvas(props);
    state.charsTexture = twgl.createTexture(gl, {
      src: charsCanvas,
      mag: gl.NEAREST,
    });

    if (
      (state.lightning.length &&
        (cols !== state.lightning[0].width ||
          rows !== state.lightning[0].height)) ||
      timestamp > 2000
    ) {
      state.resetAfter = Date.now() + 250;
    }
  }

  if (state.resetAfter && state.resetAfter < Date.now()) {
    state.resetAfter = undefined;
    state.lightning.splice(0, state.lightning.length);
    for (let i = 0; i < (isPreview ? 1 : config.preload); i++) {
      requestLightning(props);
    }
  }

  // Lightning charges up over time, so the longer since the last lightning,
  // the greater the chance of another strike
  state.lightningCharge += delta;
  const chance =
    (state.lightningCharge / 100000) *
    Math.pow(10, config.animation.frequencyFactor);
  if (state.lightning.length && random.chance(chance)) {
    let leastStrikesIndex = -1;
    for (let i = 0; i < state.lightning.length; i++) {
      if (
        leastStrikesIndex === -1 ||
        state.lightning[i].strikeAt.length <
          state.lightning[leastStrikesIndex].strikeAt.length
      ) {
        leastStrikesIndex = i;
      }
    }
    state.lightningId = leastStrikesIndex;
    state.lightning[state.lightningId].strikeAt.push(timestamp);
    state.lightningCharge = 0;

    // Conditional to ensure only one lightning is requested at a time
    if (!state.lightningRequested) {
      requestLightning(props);
    }
  }

  // Typescript infers this type correctly - it can be undefined
  const activeLightning: LightningState | undefined =
    state.lightning[state.lightningId];

  const uniforms = {
    charSize: charSize * shrinkFactor,
    charsAvailable: config.visualisation.chars.length,
    lightenFactor: config.visualisation.lighten,
    randomness: config.visualisation.randomness,
    timestamp,
    resolution: [width, height],
    chars: state.charsTexture,
    lightning: undefined as WebGLTexture | undefined,
    lightningAt: 0,
    fadeTime: config.animation.fadeTime,
  };

  if (activeLightning) {
    uniforms.lightning = activeLightning.texture;
    uniforms.lightningAt =
      activeLightning.strikeAt[activeLightning.strikeAt.length - 1];
  }

  gl.useProgram(programInfo.program);
  twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo);
  twgl.setUniforms(programInfo, uniforms);
  twgl.drawBufferInfo(gl, bufferInfo);
  return state;
};
