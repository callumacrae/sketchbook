import { easePolyIn, easePolyInOut } from 'd3-ease';

import TweakpanePlugin from '@/utils/plugins/tweakpane';
import NoiseMachine, {
  BandedNoiseGenerator,
  SimplexNoiseGenerator,
} from '@/utils/noise';
import type { SketchConfig, InitFn, FrameFn } from '@/utils/renderers/vanilla';

export const meta = {
  name: 'Noise machine',
  date: '2023-03-17',
  tags: ['Canvas 2D', 'Noise'],
};

export interface CanvasState {
  noiseMachine: NoiseMachine;
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
  const noiseMachine = new NoiseMachine();

  const generalNoiseFactor = 0.2;
  const fastNoise = new SimplexNoiseGenerator({
    inputFactor: 0.002,
    range: [0, 1],
  });
  const slowNoise = new SimplexNoiseGenerator({
    inputFactor: 0.0001,
    range: [0, generalNoiseFactor],
    factor: fastNoise,
  });
  noiseMachine.add(slowNoise);

  const bandedNoiseGenerator = new BandedNoiseGenerator({
    bandFreqency: new SimplexNoiseGenerator({
      inputFactor: 0.00001,
      range: [100, 150],
    }),
    bandSize: 50,
    factor: new SimplexNoiseGenerator({
      inputFactor: 0.001,
      range: [0, 1],
      factor(x) {
        const slowNoiseOut = slowNoise.get(x);
        return 0.2 + (generalNoiseFactor - slowNoiseOut) * 3;
      },
      easing: easePolyIn.exponent(5),
    }),
    easing: easePolyInOut.exponent(3),
  });
  noiseMachine.add(bandedNoiseGenerator);

  return { noiseMachine };
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

  ctx.strokeStyle = '#494242';
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.stroke();

  ctx.strokeStyle = '#e59c9c';

  ctx.beginPath();
  ctx.moveTo(0, height / 4);
  ctx.lineTo(width, height / 4);
  ctx.moveTo(0, (height * 3) / 4);
  ctx.lineTo(width, (height * 3) / 4);
  ctx.stroke();

  ctx.strokeStyle = 'black';

  ctx.beginPath();
  for (let x = 0; x < width; x++) {
    const y = state.noiseMachine.get(x + timestamp / 2);
    ctx[x ? 'lineTo' : 'moveTo'](x, height / 2 + (-y * height) / 4);
  }
  ctx.stroke();
};
