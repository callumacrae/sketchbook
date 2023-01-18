import { toCanvasComponent } from '@/utils/renderers/vue';
import type {
  Config,
  InitFn,
  FrameFn,
  FrameProps,
} from '@/utils/renderers/vanilla';

import Vector from '@/utils/vector';
import * as random from '@/utils/random';

interface Circle {
  center: Vector;
  radius: number;
}

interface Stick {
  from: Vector;
  to: Vector;
}

interface CanvasState {
  circles: Circle[];
  sticks: Stick[];
  needsRerender: boolean;
}

const sketchConfig = {
  minSticks: 250,
  maxSticks: 10000,
  sticksPerFrame: 3,
  minLineLength: 0.01,
  maxLineLength: 0.1,
  collisionStrategy: 'allow' as 'allow' | 'takeOld' | 'takeNew' | 'preferOld',
  retries: 5,
  circlePattern: 'grid' as 'grid' | 'bigCenter',
  debugCircles: false,
  stickWidth: 1.7,
  stickColor: '#bd6a6a',
  bgColor: '#fffcda',
};
type SketchConfig = typeof sketchConfig;

const sketchbookConfig: Partial<Config<SketchConfig>> = {
  width: 600,
  height: 600,
  useDpr: true,
  pageBg: '#aaa',
  sketchConfig,
};

const init: InitFn<CanvasState, SketchConfig> = (props) => {
  props.initControls(({ pane, config }) => {
    pane.addInput(config, 'minSticks', { min: 1, max: 10000, step: 1 });
    pane.addInput(config, 'maxSticks', { min: 1, max: 10000, step: 1 });
    pane.addInput(config, 'sticksPerFrame', { min: 1, max: 100, step: 1 });
    pane.addInput(config, 'minLineLength', { min: 0.01, max: 0.5 });
    pane.addInput(config, 'maxLineLength', { min: 0.01, max: 0.5 });
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
      options: { grid: 'grid', bigCenter: 'bigCenter' },
    });
    pane.addInput(config, 'debugCircles');
    pane.addInput(config, 'stickWidth', { min: 0.5, max: 10 });
    pane.addInput(config, 'stickColor');
    pane.addInput(config, 'bgColor');
  });

  return { circles: [], sticks: [], needsRerender: true };
};

function lineDistFromPoint(a: Vector, b: Vector, c: Vector) {
  const ab = b.sub(a);
  const ac = c.sub(a);

  const t = ac.dot(ab) / ab.dot(ab);
  if (t < 0) return ac.length();
  if (t > 1) return c.sub(b).length();

  const proj = a.add(ab.scale(t));
  return c.sub(proj).length();
}

function doLinesIntersect(a: Vector, b: Vector, c: Vector, d: Vector) {
  const det = (b.ax - a.ax) * (d.ay - c.ay) - (b.ay - a.ay) * (d.ax - c.ax);
  if (det === 0) return false;

  const lambda =
    ((d.ay - c.ay) * (d.ax - a.ax) + (c.ax - d.ax) * (d.ay - a.ay)) / det;
  const gamma =
    ((a.ay - b.ay) * (d.ax - a.ax) + (b.ax - a.ax) * (d.ay - a.ay)) / det;

  return 0 < lambda && lambda < 1 && 0 < gamma && gamma < 1;
}

function generateStick(
  props: FrameProps<CanvasState, SketchConfig>,
  attempt: number
) {
  const { config, state, width, height, dpr } = props;
  if (!config) throw new Error('???');

  const center = new Vector(
    random.range(config.minLineLength, 1 - config.minLineLength),
    random.range(config.minLineLength, 1 - config.minLineLength)
  );
  const angle = random.range(0, Math.PI * 2);
  const length = random.range(config.minLineLength, config.maxLineLength);

  const direction = new Vector(Math.cos(angle), Math.sin(angle));
  const a = center.add(direction.scale(-length / 2));
  const b = center.add(direction.scale(length / 2));

  // TODO: why doesn't this always work?!
  const bufferU = (1 / width) * ((config.stickWidth * dpr) / 2 + 2);
  const bufferV = (1 / height) * ((config.stickWidth * dpr) / 2 + 2);
  if (
    a.ax < bufferU ||
    a.ax > 1 - bufferU ||
    a.ay < bufferV ||
    a.ay > 1 - bufferV
  )
    return false;

  for (const circle of state.circles) {
    const dist = lineDistFromPoint(a, b, circle.center);
    if (dist < circle.radius) return false;
  }

  let collisionStrategy = config.collisionStrategy;
  if (collisionStrategy === 'preferOld') {
    collisionStrategy = attempt < config.retries ? 'takeOld' : 'takeNew';
  }

  if (collisionStrategy === 'takeOld') {
    for (const stick of state.sticks) {
      if (doLinesIntersect(a, b, stick.from, stick.to)) return false;
    }
  }

  if (collisionStrategy === 'takeNew') {
    for (const [i, stick] of state.sticks.entries()) {
      if (doLinesIntersect(a, b, stick.from, stick.to)) {
        state.sticks.splice(i, 1);
        state.needsRerender = true;
      }
    }
  }

  state.sticks.push({ from: a, to: b });
  return true;
}

const frame: FrameFn<CanvasState, SketchConfig> = (props) => {
  const { ctx, config, width, height, dpr, state } = props;

  if (!ctx || !config) throw new Error('???');

  if (props.hasChanged) {
    const circles = [];
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

  const drawStick = (from: Vector, to: Vector) => {
    ctx.moveTo(from.ax * width, from.ay * height);
    ctx.lineTo(to.ax * width, to.ay * height);
  };

  ctx.lineWidth = config.stickWidth * dpr;
  ctx.lineCap = 'round';
  ctx.strokeStyle = config.stickColor;

  if (!state.needsRerender) {
    if (newSticksCount) {
      const newSticks = state.sticks.slice(-newSticksCount);
      ctx.beginPath();
      for (const stick of newSticks) {
        drawStick(stick.from, stick.to);
      }
      ctx.stroke();
    }
    return state;
  }

  ctx.fillStyle = config.bgColor;
  ctx.fillRect(0, 0, width, height);

  ctx.beginPath();
  for (const stick of state.sticks) {
    drawStick(stick.from, stick.to);
  }
  ctx.stroke();

  if (config.debugCircles) {
    ctx.lineWidth = 1 * dpr;
    ctx.strokeStyle = 'blue';
    for (const circle of state.circles) {
      const [cx, cy] = circle.center.toArray();
      ctx.beginPath();
      const radius = circle.radius * Math.min(width, height);
      ctx.arc(cx * width, cy * height, radius, 0, Math.PI * 2);
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
