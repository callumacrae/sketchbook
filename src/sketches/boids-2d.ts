import Vector from '@/utils/vector';
import Vehicle from '@/utils/vehicle/vehicle';
import VehicleGroup from '@/utils/vehicle/vehicle-group';
import * as random from '@/utils/random';
import { toCanvasComponent } from '@/utils/renderers/vue';
import type { Config, InitFn, FrameFn } from '@/utils/renderers/vanilla';

export const meta = {
  name: 'Boids (2D)',
  date: '2023-02-15',
};

interface CanvasState {
  boids: VehicleGroup;
}

const sketchConfig = {
  boidCount: 250,
  behaviourWeights: {
    seek: 0.1,
    flee: 0.1,
    separation: 0.1,
    cohesion: 0.1,
    alignment: 0.1,
  },
};
type SketchConfig = typeof sketchConfig;

const sketchbookConfig: Partial<Config<SketchConfig>> = {
  sketchConfig,
};

const init: InitFn<CanvasState, SketchConfig> = (props) => {
  const { addEvent, initControls, width, height } = props;

  initControls(({ pane, config }) => {
    // pane.addInput(config, 'boidCount', { min: 1, max: 1000, step: 1 });
    // pane.addInput(config.behaviourWeights, 'seek', { min: 0, max: 1 });
    // pane.addInput(config.behaviourWeights, 'flee', { min: 0, max: 1 });
    pane.addInput(config.behaviourWeights, 'separation', { min: 0, max: 1 });
    pane.addInput(config.behaviourWeights, 'cohesion', { min: 0, max: 1 });
    pane.addInput(config.behaviourWeights, 'alignment', { min: 0, max: 1 });
  });

  const boids = new VehicleGroup();

  for (let i = 0; i < sketchConfig.boidCount; i++) {
    boids.addVehicle(
      new Vehicle({
        position: new Vector(
          random.range(50, width - 50),
          random.range(50, height - 50)
        ),
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
    const mousePos = new Vector(
      event.clientX - bb.left,
      event.clientY - bb.top
    ).scale(dpr);

    if (event.shiftKey) {
      state.boids.setFlee(mousePos);
      state.boids.setSeek(null);
    } else {
      state.boids.setSeek(mousePos);
      state.boids.setFlee(null);
    }
  });

  addEvent('mouseup', ({ state }) => {
    state.boids.setFlee(null);
    state.boids.setSeek(null);
  });

  return { boids };
};

const frame: FrameFn<CanvasState, SketchConfig> = ({
  ctx,
  state,
  width,
  height,
  delta,
  hasChanged,
  config,
}) => {
  if (!ctx) throw new Error('???');

  if (hasChanged) {
    state.boids.setSeparation(config.behaviourWeights.separation);
    state.boids.setCohesion(config.behaviourWeights.cohesion);
    state.boids.setAlignment(config.behaviourWeights.alignment);
  }

  ctx.clearRect(0, 0, width, height);

  for (const boid of state.boids.getVehicles()) {
    boid.step(1 / 60, delta / 1000, 3);

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
    const boidSize = 30;
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
