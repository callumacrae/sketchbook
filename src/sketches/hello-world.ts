import type { Config, InitFn, FrameFn } from '@/utils/renderers/vanilla';

export const meta = {
  name: 'Hello World',
  date: '2022-01-18',
};

export interface CanvasState {
  num: number;
}

const sketchConfig = {
  var: 1,
};
export type SketchConfig = typeof sketchConfig;

export const sketchbookConfig: Partial<Config<CanvasState, SketchConfig>> = {
  sketchConfig,
};

export const init: InitFn<CanvasState, SketchConfig> = ({ width }) => {
  console.log(width);
  return { num: 0.25 + Math.random() * 0.5 };
};

export const frame: FrameFn<CanvasState, SketchConfig> = ({
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
