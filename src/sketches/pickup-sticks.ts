import { toCanvasComponent } from '@/utils/renderers/vue';
import type {
  Config,
  InitFn,
  FrameFn,
  FrameProps,
} from '@/utils/renderers/vanilla';

import Vector from '@/utils/vector';
import Line from '@/utils/line';
import * as random from '@/utils/random';

interface Circle {
  center: Vector;
  radius: number;
}

interface CanvasState {
  circles: Circle[];
  sticks: Line[];
  needsRerender: boolean;
}

const sketchConfig = {
  minSticks: 500,
  maxSticks: 10000,
  sticksPerFrame: 4,
  minLineLength: 0.0035,
  maxLineLength: 0.05,
  collisionStrategy: 'takeOld' as 'allow' | 'takeOld' | 'takeNew' | 'preferOld',
  retries: 8,
  circlePattern: 'random' as 'none' | 'grid' | 'bigCenter' | 'random',
  debugCircles: false,
  stickWidth: 1.7,
  stickColor: '#bd6a6a',
  bgColor: '#fffcda',
};
type SketchConfig = typeof sketchConfig;

const sketchbookConfig: Partial<Config<SketchConfig>> = {
  // width: 600,
  // height: 600,
  // useDpr: true,
  pageBg: '#aaa',
  sketchConfig,
};

const init: InitFn<CanvasState, SketchConfig> = (props) => {
  props.initControls(({ pane, config }) => {
    pane.addInput(config, 'minSticks', { min: 1, max: 10000, step: 1 });
    pane.addInput(config, 'maxSticks', { min: 1, max: 50000, step: 1 });
    pane.addInput(config, 'sticksPerFrame', { min: 1, max: 100, step: 1 });
    pane.addInput(config, 'minLineLength', { min: 0.0025, max: 0.25 });
    pane.addInput(config, 'maxLineLength', { min: 0.005, max: 0.25 });
    pane.addInput(config, 'collisionStrategy', {
      options: {
        allow: 'allow',
        takeOld: 'takeOld',
        takeNew: 'takeNew',
        preferOld: 'preferOld',
      },
    });
    pane.addInput(config, 'retries', { min: 0, max: 50, step: 1 });
    pane.addInput(config, 'circlePattern', {
      options: {
        none: 'none',
        grid: 'grid',
        bigCenter: 'bigCenter',
        random: 'random',
      },
    });
    pane.addInput(config, 'debugCircles');
    pane.addInput(config, 'stickWidth', { min: 0.5, max: 10 });
    pane.addInput(config, 'stickColor');
    pane.addInput(config, 'bgColor');
  });

  return { circles: [], sticks: [], needsRerender: true };
};

function generateStick(
  props: FrameProps<CanvasState, SketchConfig>,
  attempt: number
) {
  const { config, state, width, height, dpr } = props;
  if (!config) throw new Error('???');

  const size = Math.min(width, height);

  const halfStickWidthUv = (config.stickWidth * dpr) / 2 / size;
  const center = new Vector(
    random.range(halfStickWidthUv, 1 - halfStickWidthUv),
    random.range(halfStickWidthUv, 1 - halfStickWidthUv)
  );
  const angle = random.range(0, Math.PI * 2);
  const length = random.range(config.minLineLength, config.maxLineLength);
  const stick = Line.fromAngle(center, angle, length);

  const bounds = stick.bounds();
  const bufferUv = (config.stickWidth * dpr) / 2 / size;
  if (
    bounds.topLeft.x < bufferUv ||
    bounds.bottomRight.x > 1 - bufferUv ||
    bounds.topLeft.y < bufferUv ||
    bounds.bottomRight.y > 1 - bufferUv
  ) {
    return false;
  }

  for (const circle of state.circles) {
    if (stick.distToPoint(circle.center) < circle.radius) return false;
  }

  let collisionStrategy = config.collisionStrategy;
  if (collisionStrategy === 'preferOld') {
    collisionStrategy = attempt < config.retries ? 'takeOld' : 'takeNew';
  }

  const maxDistUv = (config.stickWidth * dpr * 1.2) / size;
  if (collisionStrategy === 'takeOld') {
    for (const otherStick of state.sticks) {
      if (stick.distToLine(otherStick) < maxDistUv) {
        return false;
      }
    }
  }

  if (collisionStrategy === 'takeNew') {
    for (const [i, otherStick] of state.sticks.entries()) {
      if (stick.distToLine(otherStick) < maxDistUv) {
        state.sticks.splice(i, 1);
        state.needsRerender = true;
      }
    }
  }

  state.sticks.push(stick);
  return true;
}

const frame: FrameFn<CanvasState, SketchConfig> = (props) => {
  const { ctx, config, width, height, dpr, state } = props;

  const size = Math.min(width, height);

  if (!ctx || !config) throw new Error('???');

  if (props.hasChanged) {
    const circles: Circle[] = [];
    if (props.config?.circlePattern === 'bigCenter') {
      circles.push(
        { center: new Vector(0.5, 0.5), radius: 0.2 },
        { center: new Vector(0.25, 0.25), radius: 0.1 },
        { center: new Vector(0.25, 0.75), radius: 0.1 },
        { center: new Vector(0.75, 0.75), radius: 0.1 },
        { center: new Vector(0.75, 0.25), radius: 0.1 }
      );
    } else if (props.config?.circlePattern === 'grid') {
      const circlesX = 3;
      const circlesY = 3;
      const outerSpacing = 0.3;
      for (let x = 0; x < circlesX; x++) {
        for (let y = 0; y < circlesY; y++) {
          circles.push({
            center: new Vector(
              (x + 0.5 + outerSpacing) / (circlesX + outerSpacing * 2),
              (y + 0.5 + outerSpacing) / (circlesY + outerSpacing * 2)
            ),
            radius: 0.09,
          });
        }
      }
    } else if (props.config?.circlePattern === 'random') {
      while (circles.length < 10) {
        const center = new Vector(random.range(0, 1), random.range(0, 1));
        const radius = random.range(0.05, 0.3);

        const doesOverlap = circles.some(
          (circle) => circle.center.distTo(center) < circle.radius + radius
        );

        if (!doesOverlap) {
          circles.push({ center, radius });
        }
      }
    }
    state.circles = circles;

    state.sticks = [];
    state.needsRerender = true;
  }

  if (state.sticks.length >= config.maxSticks) {
    return;
  }

  let newSticksCount = 0;

  const toGenerate = Math.max(
    config.sticksPerFrame,
    config.minSticks - state.sticks.length
  );
  for (let i = 0; i < toGenerate; i++) {
    for (let j = 0; j <= config.retries; j++) {
      if (generateStick(props, j)) {
        newSticksCount++;
        break;
      }
    }
  }

  function uvToXy(uv: Vector): [number, number];
  function uvToXy(u: number, v: number): [number, number];
  function uvToXy(uOrVector: number | Vector, v?: number): [number, number] {
    const xOffset = (width - size) / 2;
    const yOffset = (height - size) / 2;

    if (uOrVector instanceof Vector) {
      return [uOrVector.x * size + xOffset, uOrVector.y * size + yOffset];
    }

    // There is no way this can happen shut up typescript
    if (v === undefined) throw new Error('???');

    return [uOrVector * size + xOffset, v * size + yOffset];
  }

  const drawStick = (stick: Line) => {
    ctx.moveTo(...uvToXy(stick.a));
    ctx.lineTo(...uvToXy(stick.b));
  };

  ctx.lineWidth = config.stickWidth * dpr;
  ctx.lineCap = 'round';
  ctx.strokeStyle = config.stickColor;

  if (!state.needsRerender) {
    if (newSticksCount) {
      const newSticks = state.sticks.slice(-newSticksCount);
      ctx.beginPath();
      for (const stick of newSticks) {
        drawStick(stick);
      }
      ctx.stroke();
    }
    return state;
  }

  ctx.fillStyle = config.bgColor;
  ctx.fillRect(0, 0, width, height);

  ctx.beginPath();
  for (const stick of state.sticks) {
    drawStick(stick);
  }
  ctx.stroke();

  if (config.debugCircles) {
    ctx.lineWidth = 1 * dpr;
    ctx.strokeStyle = 'blue';
    for (const circle of state.circles) {
      const [cx, cy] = circle.center.toArray();
      ctx.beginPath();
      const xy = uvToXy(cx, cy);
      ctx.arc(xy[0], xy[1], circle.radius * size, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  state.needsRerender = false;
  return state;
};

export default toCanvasComponent<CanvasState, SketchConfig>(
  init,
  frame,
  sketchbookConfig
);
