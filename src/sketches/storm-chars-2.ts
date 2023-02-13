import SimplexNoise from 'simplex-noise';
import { toCanvasComponent } from '@/utils/renderers/vue';
import type { Config, InitFn, FrameFn } from '@/utils/renderers/vanilla';
import * as random from '@/utils/random';
import { doWorkOffscreen } from '@/utils/canvas/utils';
import generateLightning from '@/utils/shapes/lightning';
import bloomCanvas from '@/utils/canvas/unreal-bloom';
import type { LightningNode } from '@/utils/shapes/lightning';
import shrinkCanvas from '@/utils/canvas/shrink';

interface CanvasState {
  simplex: SimplexNoise;
  charsCanvas: HTMLCanvasElement | OffscreenCanvas;
  lightning: ImageData[];
}

const sketchConfig = {
  maxWidth: 5,
  visualisation: {
    chars: '.,;*^/\\oOxX',
    charSize: window.devicePixelRatio > 1 ? 15 : 8,
    lighten: 0.75,
    randomness: 0.8,
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
    strength: 2,
    radius: 0.5,
  },
};
type SketchConfig = typeof sketchConfig;

export const sketchbookConfig: Partial<Config<SketchConfig>> = {
  sketchConfig,
};

async function initCharsCanvas(config: SketchConfig) {
  const font = new FontFace(
    'PublicPixel',
    'url(/public_pixel/PublicPixel.ttf)'
  );
  await font.load();
  document.fonts.add(font);

  const { chars, charSize } = config.visualisation;
  const width = charSize * chars.length;
  const height = charSize;
  return doWorkOffscreen(width, height, (ctx) => {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, width, height);

    ctx.font = `${charSize * 0.75}px PublicPixel`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'white';

    for (let i = 0; i < chars.length; i++) {
      ctx.fillText(chars[i], (i + 0.5) * charSize, height / 2);
    }
  });
}

function getImageDataForLightning(props: {
  width: number;
  height: number;
  config: SketchConfig;
}) {
  const { config } = props;

  const width = Math.floor(props.width / config.visualisation.charSize) * 4;
  const height = Math.floor(props.height / config.visualisation.charSize) * 4;

  const lightning = generateLightning(null, {
    config: {
      branch: config.branch,
      wobble: config.wobble,
      origin: 'random',
    },
    width,
    height,
  });

  const oversizedCanvas = doWorkOffscreen(width, height, (ctx) => {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, width, height);
    ctx.lineCap = 'round';
    ctx.strokeStyle = config.bloom.enabled ? '#777' : 'white';

    const drawNode = (
      lightning: LightningNode,
      repeat = false,
      maxCharge = lightning.charge
    ) => {
      for (const next of lightning.next) {
        if (!next.isReturn && repeat) continue;

        ctx.lineWidth = next.isReturn
          ? config.maxWidth
          : 1 + (next.charge / maxCharge) * config.maxWidth * 1.5;
        ctx.beginPath();
        ctx.moveTo(lightning.pos.x, lightning.pos.y);
        ctx.lineTo(next.pos.x, next.pos.y);
        ctx.stroke();
        drawNode(next, repeat, maxCharge);
      }
    };

    drawNode(lightning);

    if (config.bloom.enabled) {
      bloomCanvas(ctx.canvas, config.bloom);
    }
  });

  const canvas = shrinkCanvas(oversizedCanvas, width / 4, height / 4);

  const ctx = canvas.getContext('2d');
  if (
    !(
      ctx instanceof CanvasRenderingContext2D ||
      ctx instanceof OffscreenCanvasRenderingContext2D
    )
  ) {
    throw new Error('???');
  }

  return ctx.getImageData(0, 0, width / 4, height / 4);
}

const init: InitFn<CanvasState, SketchConfig> = async ({
  initControls,
  width,
  height,
  config,
}) => {
  if (!config) throw new Error('???');

  initControls(({ pane, config }) => {
    const visFolder = pane.addFolder({ title: 'Visualisation' });
    visFolder.addInput(config.visualisation, 'charSize', { min: 1, max: 100 });
    visFolder.addInput(config.visualisation, 'lighten', { min: 0, max: 1 });
    visFolder.addInput(config.visualisation, 'randomness', { min: 0, max: 1 });

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
  });

  return {
    simplex: new SimplexNoise('seed'),
    charsCanvas: await initCharsCanvas(config),
    lightning: [getImageDataForLightning({ width, height, config })],
  };
};

const frame: FrameFn<CanvasState, SketchConfig> = async ({
  ctx,
  width,
  height,
  config,
  state,
  hasChanged,
}) => {
  if (!config || !ctx) throw new Error('???');

  const { charSize } = config.visualisation;
  const cols = Math.floor(width / charSize);
  const rows = Math.floor(height / charSize);

  if (hasChanged) {
    state.charsCanvas = await initCharsCanvas(config);

    if (cols !== state.lightning[0].width || rows !== state.lightning[0].height) {
      state.lightning = [getImageDataForLightning({ width, height, config })];
    }
  }

  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, width, height);

  ctx.font = `${charSize}px PublicPixel`;
  ctx.textBaseline = 'middle';

  const s = state.lightning[0].data;

  for (let y = 0; y < Math.floor(rows); y++) {
    for (let x = 0; x < Math.floor(cols); x++) {
      const i = (y * cols + x) * 4;
      let l = (0.2126 * s[i] + 0.7152 * s[i + 1] + 0.0722 * s[i + 2]) / 256;

      const r =
        random.value() * (1 - (1 - config.visualisation.randomness) * 0.05);
      if (r > 0.995) {
        l += 0.5;
      } else if (r > 0.98) {
        l += 0.1;
      }

      const char = luminosityToChar(l, config.visualisation.lighten);

      const charIndex = config.visualisation.chars.indexOf(char);
      ctx.drawImage(
        state.charsCanvas,
        charSize * charIndex,
        0,
        charSize,
        charSize,
        x * charSize,
        y * charSize,
        charSize,
        charSize
      );
    }
  }

  return state;
};

function luminosityToChar(l: number, lighten: number) {
  // when lighten is 0.7:
  // 0 => 0
  // 0.25 => 0.35
  // 0.5 => 0.7
  // 0.75 => 0.85
  // 1 => 1
  const adjustedL = l < 0.5 ? l * 2 * lighten : 1 - (1 - l) * 2 * (1 - lighten);
  if (adjustedL < 0.1) return '.';
  if (adjustedL < 0.18) return ',';
  if (adjustedL < 0.24) return ';';
  if (adjustedL < 0.3) return '*';
  if (adjustedL < 0.5) return '^';
  if (adjustedL < 0.55) return '/';
  if (adjustedL < 0.6) return '\\';
  if (adjustedL < 0.87) return 'o';
  if (adjustedL < 0.9) return 'O';
  if (adjustedL < 0.98) return 'x';
  return 'X';
}

export default toCanvasComponent<CanvasState, SketchConfig>(
  init,
  frame,
  sketchbookConfig
);
