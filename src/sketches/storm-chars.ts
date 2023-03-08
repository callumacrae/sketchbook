import SimplexNoise from 'simplex-noise';
import type { Config, InitFn, FrameFn } from '@/utils/renderers/vanilla';
import { pixelateImage } from '@/utils/textures/sampler';
import * as random from '@/utils/random';

export const meta = {
  name: 'Storm chars',
  date: '2022-02-15',
  tags: ['Canvas 2D', 'Generative art', 'Slow', 'No preview'],
};

interface CanvasState {
  simplex: SimplexNoise;
  sampled?: { path: string; data: number[]; cols: number; rows: number };
  background?: { data: ImageData; cols: number; rows: number };
  randomImage?: string;
  randomImageFrames?: number;
}

const images = [
  '/storm-chars/iStock-101579165.jpg',
  '/storm-chars/iStock-1038878814.jpg',
  '/storm-chars/iStock-105758825.jpg',
  '/storm-chars/iStock-117536506.jpg',
  '/storm-chars/iStock-135161879.jpg',
  '/storm-chars/iStock-139899106.jpg',
  '/storm-chars/iStock-139973199.jpg',
  '/storm-chars/iStock-153156937.jpg',
  '/storm-chars/iStock-156338907.jpg',
  '/storm-chars/iStock-157195790.jpg',
  '/storm-chars/iStock-157376480.jpg',
  '/storm-chars/iStock-160232438.jpg',
  '/storm-chars/iStock-165823307.jpg',
  '/storm-chars/iStock-165855349.jpg',
  '/storm-chars/iStock-177520692.jpg',
  '/storm-chars/iStock-180830644.jpg',
  '/storm-chars/iStock-181075830.jpg',
  '/storm-chars/iStock-182175264.jpg',
  '/storm-chars/iStock-182813561.jpg',
  '/storm-chars/iStock-184084941.jpg',
  '/storm-chars/iStock-495094620.jpg',
  '/storm-chars/iStock-92027098.jpg',
  '/storm-chars/iStock-92511344.jpg',
  '/storm-chars/iStock-96163126.jpg',
  '/storm-chars/iStock-97739310.jpg',
];

const sketchConfig = {
  image: 'random',
  charSize: window.devicePixelRatio > 1 ? 15 : 8,
  lighten: 0.75,
  randomness: 0.8,
};

type SketchConfig = typeof sketchConfig;

export const sketchbookConfig: Partial<Config<CanvasState, SketchConfig>> = {
  // animate: false,
  sketchConfig,
};

export const init: InitFn<CanvasState, SketchConfig> = async ({
  initControls,
  config,
  width,
  height,
}) => {
  if (!config) {
    throw new Error('no config??');
  }

  initControls(({ pane, config }) => {
    pane.addInput(config, 'image', {
      options: {
        random: 'random',
        ...Object.fromEntries(images.entries()),
      },
    });
    pane.addInput(config, 'charSize', { min: 1, max: 100 });
    pane.addInput(config, 'lighten', { min: 0, max: 1 });
    pane.addInput(config, 'randomness', { min: 0, max: 1 });
  });

  const cols = Math.floor(width / config.charSize);
  const rows = Math.floor(height / config.charSize);

  for (const image of images) {
    await pixelateImage(image, cols, rows);
  }

  const font = new FontFace(
    'PublicPixel',
    'url(/public_pixel/PublicPixel.ttf)'
  );
  await font.load();
  document.fonts.add(font);

  return { simplex: new SimplexNoise('seed') };
};

export const frame: FrameFn<CanvasState, SketchConfig> = async ({
  ctx,
  width,
  height,
  config,
  state,
}) => {
  if (!config || !ctx) throw new Error('???');

  const cols = Math.floor(width / config.charSize);
  const rows = Math.floor(height / config.charSize);

  const offsetX = ((width / config.charSize) % 1) / 2 + 0.5;
  const offsetY = ((height / config.charSize) % 1) / 2 + 0.5;

  if (
    !state.background ||
    state.background.rows !== rows ||
    state.background.cols !== cols
  ) {
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = width;
    bgCanvas.height = height;

    const bgCtx = bgCanvas.getContext('2d');

    if (!bgCtx) throw new Error('typescript is weird');

    bgCtx.fillStyle = 'black';
    bgCtx.fillRect(0, 0, width, height);

    bgCtx.font = `${config.charSize}px PublicPixel`;
    bgCtx.textBaseline = 'middle';
    bgCtx.fillStyle = 'white';

    for (let y = 0; y < Math.floor(rows); y++) {
      const line = Array.from({ length: cols }, () => '.').join('');

      bgCtx.fillText(
        line,
        offsetX * config.charSize,
        (y + offsetY) * config.charSize
      );
    }

    state.background = {
      data: bgCtx.getImageData(0, 0, width, height),
      rows,
      cols,
    };
  }

  let image = config.image;

  if (image === 'random' && random.value() > 0.9) {
    image = random.pick(images);
    state.randomImage = image;
    state.randomImageFrames = random.floorRange(1, 4);
  } else if (state.randomImage && state.randomImageFrames) {
    image = state.randomImage;

    if (state.randomImageFrames && state.randomImageFrames-- === 0) {
      state.randomImage = undefined;
    }
  }

  let s;
  if (image === 'random') {
    s = Array.from({ length: rows * cols * 4 }, () => 0);
  } else {
    if (
      !state.sampled ||
      state.sampled.path !== image ||
      state.sampled.rows !== rows ||
      state.sampled.cols !== cols
    ) {
      state.sampled = {
        path: image,
        data: await pixelateImage(image, cols, rows),
        cols,
        rows,
      };
    }

    s = state.sampled.data;
  }

  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, width, height);

  if (state.background.data) {
    ctx.putImageData(state.background.data, 0, 0);
  }

  ctx.font = `${config.charSize}px PublicPixel`;
  ctx.textBaseline = 'middle';

  for (let y = 0; y < Math.floor(rows); y++) {
    for (let x = 0; x < Math.floor(cols); x++) {
      const i = (y * cols + x) * 4;
      let l = (0.2126 * s[i] + 0.7152 * s[i + 1] + 0.0722 * s[i + 2]) / 256;

      const r = random.value() * (1 - (1 - config.randomness) * 0.05);
      if (r > 0.995) {
        l += 0.5;
      } else if (r > 0.98) {
        l += 0.1;
      }

      if (l < 0.1) {
        continue;
      }

      const char = luminosityToChar(l, config.lighten);
      const charX = (x + offsetX) * config.charSize;
      const charY = (y + offsetY) * config.charSize;

      ctx.fillStyle = 'black';
      // isn't actually in the exact right place, but still covers the dot
      ctx.fillRect(charX, charY, config.charSize, config.charSize);
      ctx.fillStyle = 'white';
      ctx.fillText(char, charX, charY);
    }
  }
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
