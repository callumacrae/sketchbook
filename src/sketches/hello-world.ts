import TweakpanePlugin from '@/utils/plugins/tweakpane';
import type { SketchConfig, InitFn, FrameFn } from '@/utils/renderers/vanilla';

export const meta = {
  name: 'Hello World',
  date: '2022-01-18',
  tags: ['Canvas 2D', 'Hello World'],
};

export interface CanvasState {
  num: number;
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
  return { num: 0.25 + Math.random() * 0.5 };
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

  ctx.beginPath();
  ctx.arc(
    width * state.num,
    height / 2 + Math.sin(timestamp / 1e3) * 100,
    100,
    0,
    Math.PI * 2
  );
  ctx.fill();
};
