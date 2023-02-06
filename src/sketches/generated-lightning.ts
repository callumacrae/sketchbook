import SimplexNoise from 'simplex-noise';

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
  next: LightningNode[];
  parent: LightningNode | null;
}

interface CanvasState {
  simplex: SimplexNoise;
  lightning: LightningNode;
}

const sketchConfig = {
  branchFactor: 0.02,
  wobble: {
    segmentLength: 20,
    biasToPerfect: 0.3,
    biasToPerfectVariance: 0.5,
    randomFactor: 5,
  },
};
type SketchConfig = typeof sketchConfig;

const sketchbookConfig: Partial<Config<SketchConfig>> = {
  sketchConfig,
};

function generateLightning(
  {
    config,
    width,
    height,
  }: InitProps<SketchConfig> | FrameProps<CanvasState, SketchConfig>,
  simplex: SimplexNoise
) {
  if (!config) throw new Error('???');

  const lightningRoot: LightningNode = {
    pos: new Vector(width / 2, 0),
    depth: 0,
    branchDirection: new Vector(0, 1),
    next: [],
    parent: null,
  };

  const lightningTips = [lightningRoot];

  let safety = 1000;
  while (safety--) {
    // pick a random branch end, biasing towards distance from ground
    let lightningTipIndex = 0;
    if (lightningTips.length > 1) {
      let lightningTipYSum = 0;
      for (const tip of lightningTips) {
        lightningTipYSum += Math.abs(tip.pos.y);
      }
      const randomY = random.range(0, lightningTipYSum);
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

    // TODO: use branch direction as perfect
    // TODO: bias towards specific points on ground?
    const perfectDirection = lightningTip.branchDirection;
    const currentDirection = lightningTip.parent
      ? lightningTip.pos.sub(lightningTip.parent.pos)
      : undefined;

    // TODO: needs to change with time i guess - or new simplex per lightning?
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

    const newLightning = {
      pos: getPoint(),
      depth: lightningTip.depth + 1,
      branchDirection: lightningTip.branchDirection,
      next: [],
      parent: lightningTip,
    };

    lightningTip.next.push(newLightning);
    lightningTips.splice(lightningTipIndex, 1, newLightning);

    if (newLightning.pos.y >= height * 0.9) {
      break;
    }

    // TODO: DRY this up
    if (random.chance(config.branchFactor)) {
      // TODO: should this bias downwards?
      const branchSide = random.chance(0.5);
      const branchOffset = random.range(Math.PI / 8, (Math.PI / 8) * 3);
      const branchDirection = lightningTip.branchDirection.rotate(
        branchSide ? branchOffset : -branchOffset
      );

      const newLightningFork = {
        pos: getPoint(),
        depth: lightningTip.depth + 1,
        branchDirection,
        next: [],
        parent: lightningTip,
      };
      lightningTip.next.push(newLightningFork);
      lightningTips.push(newLightningFork);

      if (newLightningFork.pos.y >= height * 0.9) {
        break;
      }
    }
  }

  // TODO complete all close lightningTips paths to the ground with no branching,
  // marking them as isReturn

  return lightningRoot;
}

const init: InitFn<CanvasState, SketchConfig> = (props) => {
  props.initControls(({ pane, config }) => {
    pane.addInput(config, 'branchFactor', { min: 0, max: 0.1 });
    pane.addInput(config.wobble, 'segmentLength', { min: 0, max: 100 });
    pane.addInput(config.wobble, 'biasToPerfect', { min: 0, max: 1 });
    pane.addInput(config.wobble, 'biasToPerfectVariance', { min: 0, max: 0.5 });
    pane.addInput(config.wobble, 'randomFactor', { min: 0, max: 15 });
  });
  const simplex = new SimplexNoise();
  return { simplex, lightning: generateLightning(props, simplex) };
};

const frame: FrameFn<CanvasState, SketchConfig> = (props) => {
  const { ctx, state, width, height, hasChanged } = props;
  if (!ctx) throw new Error('???');

  if (hasChanged) {
    state.lightning = generateLightning(props, state.simplex);
  }

  ctx.clearRect(0, 0, width, height);

  ctx.beginPath();
  const drawLightning = (lightning: LightningNode) => {
    for (const next of lightning.next) {
      ctx.moveTo(lightning.pos.x, lightning.pos.y);
      ctx.lineTo(next.pos.x, next.pos.y);
      drawLightning(next);
    }
  };
  drawLightning(state.lightning);
  ctx.stroke();

  return state;
};

export default toCanvasComponent<CanvasState, SketchConfig>(
  init,
  frame,
  sketchbookConfig
);
