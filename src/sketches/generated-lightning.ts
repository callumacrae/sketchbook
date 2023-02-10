import SimplexNoise from 'simplex-noise';
import { easePolyIn } from 'd3-ease';

import bloomCanvas from '@/utils/canvas/unreal-bloom';
import { toCanvasComponent } from '@/utils/renderers/vue';
import * as random from '@/utils/random';
import * as maths from '@/utils/maths';
import Vector from '@/utils/vector';
import { getNextPoint } from '@/utils/shapes/wobbly-path';
import type {
  Config,
  InitFn,
  InitProps,
  FrameFn,
  FrameProps,
} from '@/utils/renderers/vanilla';

interface LightningNode {
  pos: Vector;
  depth: number;
  isReturn?: boolean;
  branchDirection: Vector;
  charge: number; // Basically the total number of children of this node
  next: LightningNode[];
  parent: LightningNode | null;
}

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

const sketchbookConfig: Partial<Config<SketchConfig>> = {
  width: 400,
  height: 400,
  sketchConfig,
};

function doUpwards(node: LightningNode, cb: (node: LightningNode) => void) {
  if (!node.parent) return;
  cb(node.parent);
  doUpwards(node.parent, cb);
}

function generateLightning(
  seed: string,
  props:
    | InitProps<CanvasState, SketchConfig>
    | FrameProps<CanvasState, SketchConfig>
) {
  const { config, width, height } = props;
  if (!config) throw new Error('???');

  if (seed) {
    random.setSeed(seed);
  }
  const simplex = new SimplexNoise(random.string());

  const initialPosition =
    !('state' in props) || props.state.origin === 'random'
      ? new Vector(random.range(width / 4, (width / 4) * 3), 0)
      : props.state.origin;

  const lightningRoot: LightningNode = {
    pos: initialPosition,
    depth: 0,
    branchDirection: new Vector(0, 1),
    charge: 1,
    next: [],
    parent: null,
  };

  const lightningTips = [lightningRoot];

  const easeFn = easePolyIn.exponent(config.branch.biasExponent);

  let safety = 5000;
  while (safety--) {
    // pick a random branch end, biasing towards distance from ground
    let lightningTipIndex = 0;
    if (lightningTips.length > 1) {
      let lightningTipYSum = 0;
      for (const tip of lightningTips) {
        lightningTipYSum += Math.abs(tip.pos.y);
      }
      let randomY = random.range(0, lightningTipYSum);
      randomY = easeFn(randomY / lightningTipYSum) * lightningTipYSum;
      let lightningTipYSumSoFar = 0;
      for (const tip of lightningTips) {
        lightningTipYSumSoFar += Math.abs(tip.pos.y);
        if (lightningTipYSumSoFar >= randomY) {
          break;
        }
        lightningTipIndex++;
      }
    }

    const lightningTip = lightningTips[lightningTipIndex];

    // TODO: bias towards specific points on ground?
    const perfectDirection = lightningTip.branchDirection;
    const currentDirection = lightningTip.parent
      ? lightningTip.pos.sub(lightningTip.parent.pos)
      : undefined;

    const biasToPerfect = maths.saturate(
      config.wobble.biasToPerfect +
        simplex.noise2D(lightningTip.pos.x / 10, lightningTip.pos.y / 10) *
          config.wobble.biasToPerfectVariance
    );
    const getPoint = () =>
      getNextPoint(perfectDirection, currentDirection, lightningTip.pos, {
        ...config.wobble,
        biasToPerfect,
      });

    const newLightning: LightningNode = {
      pos: getPoint(),
      depth: lightningTip.depth + 1,
      branchDirection: lightningTip.branchDirection,
      charge: 1,
      next: [],
      parent: lightningTip,
    };

    lightningTip.next.push(newLightning);
    if (lightningTip.pos.x < 0 || lightningTip.pos.x > width) {
      lightningTips.splice(lightningTipIndex, 1);
    } else {
      lightningTips.splice(lightningTipIndex, 1, newLightning);
    }
    doUpwards(newLightning, (l) => l.charge++);

    if (newLightning.pos.y >= height * 0.9) {
      break;
    }

    const branchFactor =
      config.branch.factor +
      config.branch.factorWithDepth * (1 - lightningTip.pos.y / height);
    if (random.chance(branchFactor)) {
      // TODO: should this bias downwards?
      const branchSide = random.chance(0.5);
      const branchOffset = random.range(
        config.branch.angle.min,
        config.branch.angle.max
      );
      const branchDirection = lightningTip.branchDirection.rotate(
        branchSide ? branchOffset : -branchOffset
      );

      // TODO: DRY this up
      const newLightningFork: LightningNode = {
        pos: getPoint(),
        depth: lightningTip.depth + 1,
        branchDirection,
        charge: 1,
        next: [],
        parent: lightningTip,
      };
      lightningTip.next.push(newLightningFork);
      if (lightningTip.pos.x > 0 && lightningTip.pos.x < width) {
        lightningTips.push(newLightningFork);
      }
      doUpwards(newLightningFork, (l) => l.charge++);

      if (newLightningFork.pos.y >= height * 0.9) {
        break;
      }
    }
  }

  // TODO: make sure distance to ground isn't too far (e.g., shallow angle)
  const lightningTipsToClose = lightningTips.filter(
    (tip) => tip.pos.y >= height * 0.87 && tip.branchDirection.y > 0
  );
  for (const tipToClose of lightningTipsToClose) {
    let tip = tipToClose;
    tip.isReturn = true;
    doUpwards(tip, (l) => (l.isReturn = true));
    do {
      const newLightning: LightningNode = {
        pos: getNextPoint(tip.branchDirection, tip.branchDirection, tip.pos, {
          ...config.wobble,
          biasToPerfect: 1,
        }),
        depth: tip.depth + 1,
        branchDirection: tip.branchDirection,
        charge: 1,
        next: [],
        parent: tip,
        isReturn: true,
      };
      tip.next.push(newLightning);
      doUpwards(newLightning, (l) => l.charge++);
      tip = newLightning;
    } while (tip.pos.y < height);
  }

  return lightningRoot;
}

const init: InitFn<CanvasState, SketchConfig> = (props) => {
  if (!props.ctx) throw new Error('???');

  props.initControls(({ pane, config }) => {
    pane.addInput(config, 'maxWidth', { min: 1, max: 20 });

    const animationFolder = pane.addFolder({ title: 'Animation' });
    animationFolder.addInput(config.animation, 'fadeTime', {
      min: 0,
      max: 1000,
    });
    animationFolder.addInput(config.animation, 'frequencyFactor', {
      min: -1,
      max: 2,
    });
    animationFolder.addInput(config.animation, 'doubleFlashChance', {
      min: 0,
      max: 1,
    });
    animationFolder.addInput(config.animation, 'doubleFlashTime', {
      min: 0,
      max: 1000,
    });

    const lightningFolder = pane.addFolder({ title: 'Lightning branching' });
    lightningFolder.addInput(config.branch, 'factor', { min: 0, max: 0.2 });
    lightningFolder.addInput(config.branch, 'factorWithDepth', {
      min: -0.2,
      max: 0.2,
    });
    lightningFolder.addInput(config.branch, 'angle', {
      min: 0,
      max: Math.PI / 2,
    });
    lightningFolder.addInput(config.branch, 'biasExponent', {
      min: 0.1,
      max: 10,
    });

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
    state.lightning = generateLightning(state.seed, props);

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
