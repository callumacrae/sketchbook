import SimplexNoise from 'simplex-noise';
import { easePolyIn } from 'd3-ease';

import Vector from '../vector';
import * as random from '../random';
import * as maths from '../maths';
import { getNextPoint } from './wobbly-path';
import type { Config as WobbleConfig } from './wobbly-path';

export interface LightningNode {
  pos: Vector;
  depth: number;
  isReturn?: boolean;
  branchDirection: Vector;
  charge: number; // Basically the total number of children of this node
  next: LightningNode[];
  parent: LightningNode | null;
}

function doUpwards(node: LightningNode, cb: (node: LightningNode) => void) {
  if (!node.parent) return;
  cb(node.parent);
  doUpwards(node.parent, cb);
}

export default function generateLightning(
  seed: string,
  props: {
    config: {
      branch: {
        factor: number;
        factorWithDepth: number;
        angle: { min: number; max: number };
        biasExponent: number;
      };
      wobble: WobbleConfig & { biasToPerfectVariance: number };
      origin: 'random' | Vector;
    };
    width: number;
    height: number;
  }
) {
  const { config, width, height } = props;
  if (!config) throw new Error('???');

  if (seed) {
    random.setSeed(seed);
  }
  const simplex = new SimplexNoise(random.string());

  const initialPosition =
    !('state' in props) || config.origin === 'random'
      ? new Vector(random.range(width / 4, (width / 4) * 3), 0)
      : config.origin;

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
