import SimplexNoise from 'simplex-noise';
import toCanvasComponent, {
  Config,
  InitFn,
  FrameFn,
} from '../utils/to-canvas-component';
import { pixelateImage } from '../utils/textures/sampler';

interface CanvasState {
  simplex: SimplexNoise;
  sampled?: { path: string; data: number[]; cols: number; rows: number };
}

const sketchConfig = {
  image: '/public/storm-chars/iStock-97739310.jpg',
  charSize: 15,
  lighten: 0.75,
};

type SketchConfig = typeof sketchConfig;

export const sketchbookConfig: Partial<Config<SketchConfig>> = {
  animate: false,
  sketchConfig,
};

const init: InitFn<CanvasState, SketchConfig> = async ({ initControls }) => {
  initControls(({ pane, config }) => {
    pane.addInput(config, 'image', {
      options: {
        one: '/storm-chars/iStock-97739310.jpg',
        two: '/storm-chars/iStock-495094620.jpg',
        three: '/storm-chars/iStock-1038878814.jpg',
      },
    });
    pane.addInput(config, 'charSize', { min: 1, max: 100 });
    pane.addInput(config, 'lighten', { min: 0, max: 1 });
  });

  const font = new FontFace(
    'PublicPixel',
    'url(/public_pixel/PublicPixel.ttf)'
  );
  await font.load();
  document.fonts.add(font);

  return { simplex: new SimplexNoise('seed') };
};

const frame: FrameFn<CanvasState, SketchConfig> = async ({
  ctx,
  width,
  height,
  config,
  state,
}) => {
  if (!config) {
    return;
  }

  const cols = Math.floor(width / config.charSize);
  const rows = Math.floor(height / config.charSize);

  if (
    !state.sampled ||
    state.sampled.path !== config.image ||
    state.sampled.rows !== rows ||
    state.sampled.cols !== cols
  ) {
    state.sampled = {
      path: config.image,
      data: await pixelateImage(config.image, cols, rows),
      cols,
      rows,
    };
  }
  const s = state.sampled.data;

  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, width, height);

  ctx.font = `${config.charSize}px PublicPixel`;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'white';

  const offsetX = ((width / config.charSize) % 1) / 2 + 0.5;
  const offsetY = ((height / config.charSize) % 1) / 2 + 0.5;

  console.time('frame');
  for (let y = 0; y < Math.floor(rows); y++) {
    let line = '';
    for (let x = 0; x < Math.floor(cols); x++) {
      const i = (y * cols + x) * 4;
      const l = 0.2126 * s[i] + 0.7152 * s[i + 1] + 0.0722 * s[i + 2];

      line += luminosityToChar(l / 256, config.lighten);
    }

    ctx.fillText(
      line,
      (0 + offsetX) * config.charSize,
      (y + offsetY) * config.charSize
    );
  }
  console.timeEnd('frame');
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
  if (adjustedL < 0.6) return '/';
  if (adjustedL < 0.87) return 'o';
  if (adjustedL < 0.9) return 'O';
  return 'x';
}

export default toCanvasComponent<CanvasState, SketchConfig>(
  init,
  frame,
  sketchbookConfig
);
