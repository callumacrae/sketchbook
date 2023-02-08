import SimplexNoise from 'simplex-noise';
import { easePolyIn } from 'd3-ease';

import shrinkCanvas from '@/utils/canvas/shrink';
import blurCanvas from '@/utils/canvas/gaussian-blur';
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
  seed: string;
  seedChange: boolean;
  lightning: LightningNode | null;
}

const sketchConfig = {
  branchFactor: 0.04,
  branchFactorWithDepth: 0.08,
  branchAngle: { min: 0.2786896709, max: 1.216100382 },
  branchBiasExponent: 0.42,
  wobble: {
    segmentLength: 20,
    biasToPerfect: 0.66,
    biasToPerfectVariance: 0.38,
    randomFactor: 5,
  },
};
type SketchConfig = typeof sketchConfig;

const sketchbookConfig: Partial<Config<SketchConfig>> = {
  sketchConfig,
};

function doUpwards(node: LightningNode, cb: (node: LightningNode) => void) {
  if (!node.parent) return;
  cb(node.parent);
  doUpwards(node.parent, cb);
}

function generateLightning(
  seed: string,
  {
    config,
    width,
    height,
  }:
    | InitProps<CanvasState, SketchConfig>
    | FrameProps<CanvasState, SketchConfig>
) {
  if (!config) throw new Error('???');

  if (seed) {
    random.setSeed(seed);
  }
  const simplex = new SimplexNoise(random.string());

  const lightningRoot: LightningNode = {
    pos: new Vector(width / 2, 0),
    depth: 0,
    branchDirection: new Vector(0, 1),
    charge: 1,
    next: [],
    parent: null,
  };

  const lightningTips = [lightningRoot];

  const easeFn = easePolyIn.exponent(config.branchBiasExponent);

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
      config.branchFactor +
      config.branchFactorWithDepth * (1 - lightningTip.pos.y / height);
    if (random.chance(branchFactor)) {
      // TODO: should this bias downwards?
      const branchSide = random.chance(0.5);
      const branchOffset = random.range(
        config.branchAngle.min,
        config.branchAngle.max
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
  props.initControls(({ pane, config }) => {
    pane.addInput(config, 'branchFactor', { min: 0, max: 0.2 });
    pane.addInput(config, 'branchFactorWithDepth', { min: -0.2, max: 0.2 });
    pane.addInput(config, 'branchAngle', { min: 0, max: Math.PI / 2 });
    pane.addInput(config, 'branchBiasExponent', { min: 0.1, max: 10 });
    pane.addInput(config.wobble, 'segmentLength', { min: 0, max: 100 });
    pane.addInput(config.wobble, 'biasToPerfect', { min: 0, max: 1 });
    pane.addInput(config.wobble, 'biasToPerfectVariance', { min: 0, max: 0.5 });
    pane.addInput(config.wobble, 'randomFactor', { min: 0, max: 15 });
  });

  props.addEvent('click', ({ state }) => {
    state.seedChange = true;
    return true;
  });

  return { seed: 'aaa', seedChange: true, lightning: null };
};

const frame: FrameFn<CanvasState, SketchConfig> = (props) => {
  const { ctx, state, width, height, hasChanged } = props;
  if (!ctx) throw new Error('???');

  const seedChange = state.seedChange;
  if (seedChange) {
    state.seed = Math.floor(Math.random() * 1e6).toString();
    state.seedChange = false;
  }
  if (hasChanged || !state.lightning || seedChange) {
    state.lightning = generateLightning(state.seed, props);

    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, width, height);

    ctx.lineCap = 'round';
    ctx.strokeStyle = 'white';
    const drawLightning = (lightning: LightningNode) => {
      if (!state.lightning) throw new Error('???');

      for (const next of lightning.next) {
        ctx.lineWidth = next.isReturn
          ? 10
          : 1 + (next.charge / state.lightning.charge) * 15;
        ctx.beginPath();
        ctx.moveTo(lightning.pos.x, lightning.pos.y);
        ctx.lineTo(next.pos.x, next.pos.y);
        ctx.stroke();
        drawLightning(next);
      }
    };
    drawLightning(state.lightning);

    const mipmap1 = shrinkCanvas(
      ctx.canvas,
      // Math.round(width / 2),
      // Math.round(height / 2)
      256, 256
    );
    const blur1 = blurCanvas(mipmap1, 3);
    console.log(blur1);
    ctx.drawImage(blur1, 0, 0);
    // const mipmap2 = shrinkCanvas(ctx, 1 / 4, 1 / 4);
    // const blur2 = blurCanvas(mipmap2, 5);
    //
    // const mipmap3 = shrinkCanvas(ctx, 1 / 8, 1 / 8);
    // const blur3 = blurCanvas(mipmap2, 7);
    //
    // const mipmap4 = shrinkCanvas(ctx, 1 / 16, 1 / 16);
    // const blur4 = blurCanvas(mipmap2, 9);
    //
    // const mipmap5 = shrinkCanvas(ctx, 1 / 32, 1 / 32);
    // const blur5 = blurCanvas(mipmap2, 11);
    //
    // const combinedBlur = blendCanvas('average', blur1, blur2, blur3, blur4, blur5);

    // skip high pass filter - for now?
  }

  return state;
};

export default toCanvasComponent<CanvasState, SketchConfig>(
  init,
  frame,
  sketchbookConfig
);
