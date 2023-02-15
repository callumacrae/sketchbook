import Vector from '@/utils/vector';
import * as random from '@/utils/random';
import { toCanvasComponent } from '@/utils/renderers/vue';
import type { Config, InitFn, FrameFn } from '@/utils/renderers/vanilla';

export const meta = {
  name: 'Boids (2D)',
  date: '2023-02-15',
};

interface BoidState {
  position: Vector;
  direction: Vector;
}

interface CanvasState {
  boids: BoidState[];
}

const sketchConfig = {
  boidCount: 100,
};
type SketchConfig = typeof sketchConfig;

const sketchbookConfig: Partial<Config<SketchConfig>> = {
  sketchConfig,
};

const init: InitFn<CanvasState, SketchConfig> = ({ width, height }) => {
  const boids: BoidState[] = [];

  for (let i = 0; i < sketchConfig.boidCount; i++) {
    boids.push({
      position: new Vector(random.range(0, width), random.range(0, height)),
      direction: new Vector(random.range(-1, 1), random.range(-1, 1)),
    });
  }

  return { boids };
};

const frame: FrameFn<CanvasState, SketchConfig> = ({
  ctx,
  state,
  width,
  height,
  delta,
}) => {
  if (!ctx) throw new Error('???');

  ctx.clearRect(0, 0, width, height);

  for (const boid of state.boids) {
    boid.position = boid.position.add(boid.direction.setMagnitude(0.1 * delta));

    if (boid.position.x < 0) {
      boid.position.x += width;
    } else if (boid.position.x > width) {
      boid.position.x -= width;
    }

    if (boid.position.y < 0) {
      boid.position.y += height;
    } else if (boid.position.y > height) {
      boid.position.y -= height;
    }

    ctx.beginPath();
    const boidSize = 50;
    ctx.translate(boid.position.x, boid.position.y);
    ctx.rotate(boid.direction.angle());
    ctx.moveTo(0, 0);
    ctx.lineTo(-boidSize / 2, boidSize * 1.2);
    ctx.lineTo(0, boidSize * 0.95);
    ctx.lineTo(boidSize / 2, boidSize * 1.2);
    ctx.fill();
    ctx.resetTransform();
  }
};

export default toCanvasComponent<CanvasState, SketchConfig>(
  init,
  frame,
  sketchbookConfig
);
