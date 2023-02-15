import { toCanvasComponent } from '@/utils/renderers/vue';
import type { Config, InitFn, FrameFn } from '@/utils/renderers/vanilla';

export const meta = {
  name: 'Hello World',
  date: '2022-01-18',
};

interface CanvasState {
  num: number;
}

const sketchConfig = {
  var: 1,
};
type SketchConfig = typeof sketchConfig;

const sketchbookConfig: Partial<Config<SketchConfig>> = {
  sketchConfig,
};

const init: InitFn<CanvasState, SketchConfig> = ({ width }) => {
  console.log(width);
  return { num: 0.25 + Math.random() * 0.5 };
};

const frame: FrameFn<CanvasState, SketchConfig> = ({
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

export default toCanvasComponent<CanvasState, SketchConfig>(
  init,
  frame,
  sketchbookConfig
);
