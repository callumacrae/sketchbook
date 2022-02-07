import SimplexNoise from 'simplex-noise';
import toCanvasComponent, {
  Config,
  InitFn,
  FrameFn,
} from '../utils/to-canvas-component';
import Vector from '../utils/vector';

interface CanvasState {
  simplex: SimplexNoise;
}

const sketchConfig = {
  circleRadius: 0.4,
  distFactSmallA: 500,
  distFactSmallB: 50,
  distFactBigA: 300,
  distFactBigB: 500,
  smallBigMix: 0.4,
  distFactThreshold: 0.25,
  lines: 200,
  lineWidth: 2,
  segmentY: 5,
  noiseXIn: 700,
  noiseYIn: 700,
  noiseOut: 90,
};

type SketchConfig = typeof sketchConfig;

export const sketchbookConfig: Partial<Config<SketchConfig>> = {
  animate: false,
  resizeDelay: 250,
  sketchConfig,
};

const init: InitFn<CanvasState, SketchConfig> = ({ initControls }) => {
  initControls(({ pane, config }) => {
    pane.addInput(config, 'circleRadius', { min: 0.1, max: 0.9 });
    pane.addInput(config, 'distFactSmallA', { min: 50, max: 1000, step: 1 });
    pane.addInput(config, 'distFactSmallB', { min: 5, max: 1000, step: 1 });
    pane.addInput(config, 'distFactBigA', { min: 50, max: 1000, step: 1 });
    pane.addInput(config, 'distFactBigB', { min: 5, max: 1000, step: 1 });
    pane.addInput(config, 'smallBigMix', { min: 0, max: 1 });
    pane.addInput(config, 'distFactThreshold', { min: 0, max: 1 });
    pane.addInput(config, 'lines', { min: 1, max: 500, step: 1 });
    pane.addInput(config, 'lineWidth', { min: 1, max: 10 });
    pane.addInput(config, 'segmentY', { min: 1, max: 100, step: 1 });
    pane.addInput(config, 'noiseXIn', { min: 1, max: 5000, step: 1 });
    pane.addInput(config, 'noiseYIn', { min: 1, max: 5000, step: 1 });
    pane.addInput(config, 'noiseOut', { min: 1, max: 500, step: 1 });
  });

  return { simplex: new SimplexNoise('seed') };
};

type VectorAry = [number, number];

const frame: FrameFn<CanvasState, SketchConfig> = ({
  ctx,
  width,
  height,
  state,
  config,
}) => {
  if (!config) {
    return;
  }

  ctx.clearRect(0, 0, width, height);

  const simplex = state.simplex;

  const origin: VectorAry = [width / 2, height / 2];
  const maxDist = Math.min(width, height) * config.circleRadius;

  const transform = ([x, y]: VectorAry): VectorAry => {
    const offsetX =
      simplex.noise2D(x / config.noiseXIn, y / config.noiseYIn) *
      config.noiseOut;
    return [x + offsetX, y];
  };

  const mix = (a: number, b: number, factor = config.smallBigMix) =>
    a * factor + b * (1 - factor);

  const samplePoint = (point: VectorAry, untransformedPoint: VectorAry) => {
    const distFromOrigin = Vector.between(origin, point).getMagnitude();

    let pointValue = distFromOrigin < maxDist;

    // Random missing bits inside circle
    {
      const noise = simplex.noise2D(point[0] / 50, point[1] / 50);
      if (noise < -0.9) {
        pointValue = false;
      }
    }

    // Edge fuzzing
    {
      const distFromCircleEdge = Math.abs(distFromOrigin - maxDist);
      const distFactorForSmall = Math.max(
        0,
        1 - distFromCircleEdge / config.distFactSmallA
      );
      const noiseForSmall =
        simplex.noise2D(
          untransformedPoint[0],
          point[1] / config.distFactSmallB
        ) * distFactorForSmall;
      const distFactorForBig = Math.max(
        0,
        1 - distFromCircleEdge / config.distFactBigA
      );
      const noiseForBig =
        simplex.noise2D(untransformedPoint[0], point[1] / config.distFactBigB) *
        distFactorForBig;

      if (mix(noiseForSmall, noiseForBig) < -1 * config.distFactThreshold) {
        pointValue = true;
      } else if (mix(noiseForSmall, noiseForBig) > config.distFactThreshold) {
        pointValue = false;
      }
    }

    return pointValue;
  };

  ctx.lineWidth = config.lineWidth;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'black';
  for (let i = 0; i < config.lines; i++) {
    const x = (width / config.lines) * i;
    let lastPoint = transform([x, 0]);

    ctx.beginPath();
    ctx.moveTo(...lastPoint);

    for (let y = 0; y < height; y += config.segmentY) {
      const untransformedPoint: VectorAry = [x, y + config.segmentY];
      const nextPoint = transform(untransformedPoint);

      const centerPoint: VectorAry = [(lastPoint[0] + nextPoint[0]) / 2, y];

      if (samplePoint(centerPoint, untransformedPoint)) {
        ctx.lineTo(...nextPoint);
      } else {
        ctx.moveTo(...nextPoint);
      }

      lastPoint = nextPoint;
    }

    ctx.stroke();
  }
};

export default toCanvasComponent<CanvasState, SketchConfig>(
  init,
  frame,
  sketchbookConfig
);
