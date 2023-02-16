import Vector from '@/utils/vector';
import Boid from '@/utils/boids/boid';
import BoidGroup from '@/utils/boids/boid-group';
import * as random from '@/utils/random';
import { toCanvasComponent } from '@/utils/renderers/vue';
import type { Config, InitFn, FrameFn } from '@/utils/renderers/vanilla';

export const meta = {
  name: 'Boids (2D)',
  date: '2023-02-15',
};

interface CanvasState {
  boids: BoidGroup;
}

const sketchConfig = {
  boidCount: 50,
};
type SketchConfig = typeof sketchConfig;

const sketchbookConfig: Partial<Config<SketchConfig>> = {
  sketchConfig,
};

const init: InitFn<CanvasState, SketchConfig> = (props) => {
  const { addEvent, width, height } = props;

  const boids = new BoidGroup();

  for (let i = 0; i < sketchConfig.boidCount; i++) {
    boids.addBoid(
      new Boid({
        position: new Vector(random.range(50, width - 50), random.range(50, height - 50)),
        velocity: Vector.fromAngle(
          random.range(0, Math.PI * 2),
          random.range(40, 200)
        ),
      })
    );
  }

  addEvent('mousemove', ({ ctx, event, dpr, state }) => {
    if (!ctx) throw new Error('???');
    if (!event.buttons) return;
    const bb = ctx.canvas.getBoundingClientRect();
    const seekPoint = new Vector(
      event.clientX - bb.left,
      event.clientY - bb.top
    ).scale(dpr);

    state.boids.seek(seekPoint);
  });

  addEvent('mouseup', ({ state }) => {
    state.boids.seek(null);
  });

  return { boids, };
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

  for (const boid of state.boids.getBoids()) {
    boid.step(1 / 60, delta / 1000, 3);

    if (boid.position.x < 0) {
      boid.velocity.x = Math.abs(boid.velocity.x);
    } else if (boid.position.x > width) {
      boid.velocity.x = -Math.abs(boid.velocity.x);
    }

    if (boid.position.y < 0) {
      boid.velocity.y = Math.abs(boid.velocity.x);
    } else if (boid.position.y > height) {
      boid.velocity.y = -Math.abs(boid.velocity.x);
    }

    ctx.beginPath();
    const boidSize = 50;
    ctx.translate(boid.position.x, boid.position.y);
    ctx.rotate(boid.velocity.angle());
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
