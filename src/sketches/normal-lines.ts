import Vector from '@/utils/vector';
import generatePath from '@/utils/shapes/wobbly-path';
import * as random from '@/utils/random';
import { doWorkOffscreen } from '@/utils/canvas/utils';
import { toCanvasComponent } from '@/utils/renderers/vue';
import type { Config, InitFn, FrameFn } from '@/utils/renderers/vanilla';

export const meta = {
  name: 'Normal lines',
  date: '2020-06-10',
  favourite: true,
  link: 'https://codepen.io/callumacrae/full/RwRmgog',
};

interface CanvasState {
  lines: any[];
  bitmaps: any[];
}

const opacity = 0.6;
const isMobile = window.innerWidth < 500;
const sketchConfig = {
  NUMBER_OF_LINES: isMobile ? 1000 : 2000,
  GROUP_BY: 100,
  startLength: () => random.range(0.12, 0.35),
  endLength: () => random.range(0.39, 0.47),
  BACKGROUND_COLOR: '#262819',
  // https://color.adobe.com/Passado1-color-theme-8032401/
  COLORS: [
    `rgb(83, 84, 115, ${opacity})`, // blue
    `rgba(214, 216, 209, ${opacity})`, // white
    `rgba(159, 145, 124, ${opacity})`, // cream
    `rgba(142, 55, 48, ${opacity})`, // red
  ],
  LINE_WIDTH: isMobile ? 0.004 : 0.002,
  PATH: {
    segmentLength: 10,
    biasToPerfect: 0.5,
    randomFactor: 1,
  },
};
type SketchConfig = typeof sketchConfig;

const sketchbookConfig: Partial<Config<SketchConfig>> = {
  sketchConfig,
};

const init: InitFn<CanvasState, SketchConfig> = ({ config, width, height }) => {
  if (!config) throw new Error('???');

  const uvFactor = Math.min(width, height);

  const lines = [];
  for (let i = 0; i < config.NUMBER_OF_LINES; i++) {
    const randomDirection = new Vector(
      random.range(-0.5, 0.5),
      random.range(-0.5, 0.5)
    );
    const start = randomDirection.setMagnitude(config.startLength() * uvFactor);
    const end = randomDirection.setMagnitude(config.endLength() * uvFactor);
    lines.push({
      path: generatePath([start, end], config.PATH),
      color: random.pick(config.COLORS),
    });
  }

  const origin = new Vector(width / 2, height / 2);

  const bitmaps = [];
  // We have to predraw the lines in groups or it's like 15fps
  // If I were to revisit this, I'd use webgl!
  for (let i = 0; i < lines.length; i += config.GROUP_BY) {
    const linesGroup = lines.slice(i, i + config.GROUP_BY);
    const bitmap = doWorkOffscreen(width, height, (ctx) => {
      ctx.translate(origin.x, origin.y);
      ctx.lineWidth = config.LINE_WIDTH * uvFactor;
      linesGroup.forEach(({ path, color }) => {
        ctx.beginPath();
        ctx.moveTo(path[0].x, path[0].y);
        path.slice(1).forEach((point) => {
          ctx.lineTo(point.x, point.y);
        });
        ctx.strokeStyle = color;
        ctx.stroke();
      });
    });
    bitmaps.push(bitmap);
  }

  return { lines, bitmaps };
};

const frame: FrameFn<CanvasState, SketchConfig> = ({
  config,
  ctx,
  state,
  width,
  height,
  timestamp,
}) => {
  if (!ctx || !config) throw new Error('???');

  const t = timestamp / 12e3;

  const { bitmaps } = state;

  ctx.globalAlpha = 1;
  ctx.fillStyle = config.BACKGROUND_COLOR;
  ctx.fillRect(0, 0, width, height);
  bitmaps.forEach((bitmap, i) => {
    const adjustedT = (t + i / bitmaps.length) % 1;
    const alpha = adjustedT < 0.9 ? 1 : Math.abs(0.95 - adjustedT) * 20;
    ctx.globalAlpha = alpha;
    ctx.drawImage(bitmap, 0, 0, width, height);
  });
};

export default toCanvasComponent<CanvasState, SketchConfig>(
  init,
  frame,
  sketchbookConfig
);
