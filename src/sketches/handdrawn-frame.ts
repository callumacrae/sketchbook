import { makeFrame } from '@/utils/shapes/hand-drawn-frame';
import TweakpanePlugin from '@/utils/plugins/tweakpane';
import type { Point } from '@/utils/shapes/hand-drawn-frame';
import type { SketchConfig, InitFn, FrameFn } from '@/utils/renderers/vanilla';

export const meta = {
  name: 'Hand drawn frame',
  date: '2023-03-03',
  tags: ['Canvas 2D'],
};

export interface CanvasState {
  points: Point[];
}

const userConfig = {
  width: 500,
  height: 200,
  strokeWidth: 5,
  resolution: 16,
  wiggle: 2,
};
export type UserConfig = typeof userConfig;

const tweakpanePlugin = new TweakpanePlugin<CanvasState, UserConfig>(
  ({ pane, config }) => {
    pane.addInput(config, 'width', { min: 100, max: 1000, step: 1 });
    pane.addInput(config, 'height', { min: 100, max: 1000, step: 1 });
    pane.addInput(config, 'strokeWidth', { min: 1, max: 20 });
    pane.addInput(config, 'resolution', { min: 1, max: 50, step: 1 });
    pane.addInput(config, 'wiggle', { min: 0, max: 20 });
  }
);

export const sketchConfig: Partial<SketchConfig<CanvasState, UserConfig>> = {
  userConfig,
  plugins: [tweakpanePlugin],
};

export const init: InitFn<CanvasState, UserConfig> = ({ addEvent }) => {
  addEvent('click', () => true);

  return { points: [] };
};

export const frame: FrameFn<CanvasState, UserConfig> = ({
  ctx,
  state,
  width,
  height,
  hasChanged,
  userConfig: config,
}) => {
  if (!ctx) throw new Error('???');

  if (!hasChanged) return;

  state.points = makeFrame(
    config.width,
    config.height,
    config.resolution,
    config.wiggle
  );

  ctx.clearRect(0, 0, width, height);

  ctx.lineWidth = config.strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.translate(width / 2 - config.width / 2, height / 2 - config.height / 2);
  ctx.moveTo(...state.points[0]);
  for (let i = 1; i < state.points.length; i++) {
    ctx.lineTo(...state.points[i]);
  }
  ctx.stroke();
  ctx.resetTransform();
};
