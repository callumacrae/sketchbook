import SimplexNoise from 'simplex-noise';

import TweakpanePlugin from '@/utils/plugins/tweakpane';
import type { SketchConfig, InitFn, FrameFn } from '@/utils/renderers/vanilla';

export const meta = {
  name: 'Flow field doughnut 2D',
  date: '2023-03-18',
  tags: ['Canvas 2D', 'Flow field'],
};

export interface CanvasState {
  simplex: SimplexNoise;
}

const userConfig = {
  var: 1,
};
export type UserConfig = typeof userConfig;

const tweakpanePlugin = new TweakpanePlugin<CanvasState, UserConfig>();

export const sketchConfig: Partial<SketchConfig<CanvasState, UserConfig>> = {
  userConfig,
  plugins: [tweakpanePlugin],
};

export const init: InitFn<CanvasState, UserConfig> = () => {
  return { simplex: new SimplexNoise() };
};

export const frame: FrameFn<CanvasState, UserConfig> = ({
  ctx,
  state,
  width,
  height,
  timestamp,
}) => {
  if (!ctx) throw new Error('???');

  ctx.clearRect(0, 0, width, height);

  const innerRing = Math.min(width, height) / 10;
  const outerRing = Math.min(width, height) / 2.5;

  ctx.fillStyle = '#d5d5d5';
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, outerRing, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, innerRing, 0, Math.PI * 2);
  ctx.fill();

  const resolution = 30;
  const variance = Math.PI / 6;

  ctx.fillStyle = 'black';

  for (let x = 0; x < width; x += resolution) {
    for (let y = 0; y < height; y += resolution) {
      const distFromCenter = Math.sqrt(
        (x - width / 2) ** 2 + (y - height / 2) ** 2
      );
      if (distFromCenter < innerRing || distFromCenter > outerRing) {
        ctx.strokeStyle = ctx.fillStyle = '#d5d5d5';
      } else {
        ctx.strokeStyle = ctx.fillStyle = 'black';
      }

      // const angle = state.simplex.noise2D(x, y) * Math.PI * 2;
      const angle = Math.atan2(y - height / 2, x - width / 2) - Math.PI / 2;

      // This ensures that the field never points out of the circle
      const angleOffset =
        variance / 2 -
        ((distFromCenter - innerRing) / (outerRing - innerRing)) * variance;

      const noise =
        (state.simplex.noise3D(x / 100, y / 100, timestamp / 2000) * variance) /
        2;

      const lineLength = resolution * 0.8;

      ctx.translate(x, y);
      ctx.rotate(angle + angleOffset + noise);
      ctx.beginPath();
      ctx.moveTo(lineLength / -2, 0);
      ctx.lineTo(lineLength / 2, 0);
      ctx.stroke();

      const arrowSize = lineLength / 4;
      ctx.moveTo(lineLength / 2, 0);
      ctx.lineTo(lineLength / 2 - arrowSize, arrowSize / 2);
      ctx.lineTo(lineLength / 2 - arrowSize, -arrowSize / 2);
      ctx.fill();

      ctx.resetTransform();
    }
  }
};
