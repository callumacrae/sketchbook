import bloomCanvas from '@/utils/canvas/unreal-bloom';
import { toCanvasComponent } from '@/utils/renderers/vue';
import * as random from '@/utils/random';
import Vector from '@/utils/vector';
import generateLightning from '@/utils/shapes/lightning';
import type { Config, InitFn, FrameFn } from '@/utils/renderers/vanilla';
import type { LightningNode } from '@/utils/shapes/lightning';

export const meta = {
  name: 'Generated lightning',
  date: '2023-02-02',
  tags: ['Canvas 2D', 'Generative art'],
};

interface CanvasState {
  lightningCharge: number;
  origin: 'random' | Vector;
  seed: string;
  seedChange: boolean;
  lightning: LightningNode | null;
  repeat?: {
    after: number;
    lightning: LightningNode;
  } | null;
}

const sketchConfig = {
  maxWidth: 8,
  animation: {
    fadeTime: 100,
    frequencyFactor: 0.4,
    doubleFlashChance: 0.2,
    doubleFlashTime: 150,
  },
  branch: {
    factor: 0.03,
    factorWithDepth: 0.04,
    angle: { min: 0.2786896709, max: 1.216100382 },
    biasExponent: 0.42,
  },
  wobble: {
    segmentLength: 10,
    biasToPerfect: 0.66,
    biasToPerfectVariance: 0.38,
    randomFactor: 2.5,
  },
  bloom: {
    enabled: false,
    passes: 5,
    strength: 5,
    radius: 1.2,
  },
};
type SketchConfig = typeof sketchConfig;

const sketchbookConfig: Partial<Config<CanvasState, SketchConfig>> = {
  width: 400,
  height: 400,
  sketchConfig,
};

const init: InitFn<CanvasState, SketchConfig> = (props) => {
  if (!props.ctx) throw new Error('???');

  props.initControls(({ pane, config }) => {
    pane.addInput(config, 'maxWidth', { min: 1, max: 20 });

    const animFolder = pane.addFolder({ title: 'Animation' });
    animFolder.addInput(config.animation, 'fadeTime', { min: 0, max: 1000 });
    animFolder.addInput(config.animation, 'frequencyFactor', {
      min: -1,
      max: 2,
    });
    animFolder.addInput(config.animation, 'doubleFlashChance', {
      min: 0,
      max: 1,
    });
    animFolder.addInput(config.animation, 'doubleFlashTime', {
      min: 0,
      max: 1000,
    });

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

    const bloomFolder = pane.addFolder({ title: 'Bloom' });
    bloomFolder.addInput(config.bloom, 'enabled');
    bloomFolder.addInput(config.bloom, 'passes', { min: 0, max: 15 });
    bloomFolder.addInput(config.bloom, 'strength', { min: 0, max: 15 });
    bloomFolder.addInput(config.bloom, 'radius', { min: 0, max: 5 });
  });

  props.addEvent('mousedown', ({ ctx, state, event, dpr }) => {
    if (!ctx) throw new Error('???');
    const bb = ctx.canvas.getBoundingClientRect();
    state.origin = new Vector(
      event.clientX - bb.left,
      event.clientY - bb.top
    ).scale(dpr);
    state.seedChange = true;
    return true;
  });

  props.addEvent('mousemove', ({ ctx, state, event, dpr }) => {
    if (!ctx) throw new Error('???');
    if (state.origin === 'random') return;
    const bb = ctx.canvas.getBoundingClientRect();
    state.origin = new Vector(
      event.clientX - bb.left,
      event.clientY - bb.top
    ).scale(dpr);
  });

  props.addEvent('mouseup', ({ state }) => {
    state.origin = 'random';
  });

  props.addEvent('mouseout', ({ state }) => {
    state.origin = 'random';
  });

  props.ctx.fillStyle = 'black';
  props.ctx.fillRect(0, 0, props.width, props.height);

  return {
    lightningCharge: 10000,
    origin: 'random',
    seed: 'aaa',
    seedChange: true,
    lightning: null,
  };
};

const frame: FrameFn<CanvasState, SketchConfig> = (props) => {
  const { ctx, config, state, width, height, hasChanged } = props;
  if (!ctx || !config) throw new Error('???');

  const framesToFade = config.animation.fadeTime / props.delta;
  ctx.fillStyle = `rgba(0, 0, 0, ${1 / framesToFade})`;
  ctx.fillRect(0, 0, width, height);

  if (!state.repeat) {
    // Lightning charges up over time, so the longer since the last lightning,
    // the greater the chance of another strike
    state.lightningCharge += props.delta;
    const chance =
      (state.lightningCharge / 100000) *
      Math.pow(10, config.animation.frequencyFactor) *
      (state.origin === 'random' ? 1 : 2);
    if (random.chance(chance)) {
      state.seedChange = true;
      state.lightningCharge = 0;
    }
  }

  const drawLightning = (
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
      drawLightning(next, repeat, maxCharge);
    }
  };

  const seedChange = state.seedChange;
  if (seedChange) {
    state.seed = Math.floor(Math.random() * 1e6).toString();
    state.seedChange = false;
  }

  ctx.lineCap = 'round';
  ctx.strokeStyle = config.bloom.enabled ? '#555' : 'white';

  if (state.repeat) {
    if (Date.now() > state.repeat.after) {
      drawLightning(state.repeat.lightning, true);

      if (config.bloom.enabled) {
        bloomCanvas(ctx.canvas, config.bloom);
      }

      state.repeat = null;
    }
  } else if (hasChanged || !state.lightning || seedChange) {
    state.lightning = generateLightning(state.seed, {
      config: {
        branch: config.branch,
        wobble: config.wobble,
        origin: state.origin,
      },
      width: width,
      height: height,
    });

    if (random.chance(config.animation.doubleFlashChance)) {
      state.repeat = {
        lightning: state.lightning,
        after: Date.now() + config.animation.doubleFlashTime,
      };
    }

    drawLightning(state.lightning);

    if (config.bloom.enabled) {
      bloomCanvas(ctx.canvas, config.bloom);
    }
  }

  return state;
};

export default toCanvasComponent<CanvasState, SketchConfig>(
  init,
  frame,
  sketchbookConfig
);
