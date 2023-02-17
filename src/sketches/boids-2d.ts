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
  boids: {
    count: 300,
    minVelocity: 200,
    maxVelocity: 300,
    maxForce: 1000,
  },
  neighbours: {
    distance: 100,
  },
  behaviours: {
    seekWeight: 5,
    fleeWeight: 5,
    separationWeight: 0.5,
    cohesionWeight: 0.4,
    alignmentWeight: 0.6,
    avoidWallsLookAhead: 1,
    avoidWallsWeight: 5,
  },
};
type SketchConfig = typeof sketchConfig;

const sketchbookConfig: Partial<Config<SketchConfig>> = {
  sketchConfig,
};

function newBoid(width: number, height: number) {
  return new Vehicle({
    position: new Vector(
      random.range(50, width - 50),
      random.range(50, height - 50)
    ),
    velocity: Vector.fromAngle(
      random.range(0, Math.PI * 2),
      random.range(200, 400)
    ),
  });
}

const init: InitFn<CanvasState, SketchConfig> = (props) => {
  const { addEvent, initControls, width, height } = props;

  initControls(({ pane, config }) => {
    const boidsFolder = pane.addFolder({ title: 'Boids' });
    boidsFolder.addInput(config.boids, 'count', { min: 1, max: 1000, step: 1 });
    boidsFolder.addInput(config.boids, 'minVelocity', {
      min: 0,
      max: 1000,
    });
    boidsFolder.addInput(config.boids, 'maxVelocity', {
      min: 0,
      max: 1000,
    });
    boidsFolder.addInput(config.boids, 'maxForce', { min: 0, max: 4000 });

    const neighboursFolder = pane.addFolder({ title: 'Neighbours' });
    neighboursFolder.addInput(config.neighbours, 'distance', {
      min: 0,
      max: 500,
    });

    const behavioursFolder = pane.addFolder({ title: 'Behaviours' });
    behavioursFolder.addInput(config.behaviours, 'seekWeight', { min: 0, max: 20 });
    behavioursFolder.addInput(config.behaviours, 'fleeWeight', { min: 0, max: 20 });
    behavioursFolder.addInput(config.behaviours, 'separationWeight', {
      min: 0,
      max: 2,
    });
    behavioursFolder.addInput(config.behaviours, 'cohesionWeight', {
      min: 0,
      max: 2,
    });
    behavioursFolder.addInput(config.behaviours, 'alignmentWeight', {
      min: 0,
      max: 2,
    });
    behavioursFolder.addInput(config.behaviours, 'avoidWallsLookAhead', {
      min: 0,
      max: 4,
    });
    behavioursFolder.addInput(config.behaviours, 'avoidWallsWeight', {
      min: 0,
      max: 10,
    });
  });

  const boids = new VehicleGroup();

  for (let i = 0; i < sketchConfig.boids.count; i++) {
    boids.addVehicle(newBoid(width, height));
  }

  addEvent('mousemove', ({ config, ctx, event, dpr, state }) => {
    if (!ctx) throw new Error('???');
    if (!event.buttons) return;
    const bb = ctx.canvas.getBoundingClientRect();
    const mousePos = new Vector(
      event.clientX - bb.left,
      event.clientY - bb.top
    ).scale(dpr);

    if (event.shiftKey) {
      state.boids.setFlee(mousePos, config.behaviours.fleeWeight);
      state.boids.setSeek(null);
    } else {
      state.boids.setSeek(mousePos, config.behaviours.seekWeight);
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
    state.boids.setSeparation(config.behaviours.separationWeight);
    state.boids.setCohesion(config.behaviours.cohesionWeight);
    state.boids.setAlignment(config.behaviours.alignmentWeight);

    const hitsWall = (current: Vector, ahead: Vector) => {
      const buffer = 50;
      const rLeft = (buffer - current.x) / ahead.x;
      const rRight = (width - buffer - current.x) / ahead.x;

      const rTop = (buffer - current.y) / ahead.y;
      const rBottom = (height - buffer - current.y) / ahead.y;

      const candidates = [];
      if (rLeft > 0 && rLeft < 1) candidates.push(rLeft);
      if (rRight > 0 && rRight < 1) candidates.push(rRight);
      if (rTop > 0 && rTop < 1) candidates.push(rTop);
      if (rBottom > 0 && rBottom < 1) candidates.push(rBottom);

      if (candidates.length) {
        return Math.min(...candidates);
      }

      // Already behind wall
      if (
        current.x < buffer ||
        current.x > width - buffer ||
        current.y < buffer ||
        current.y > height - buffer
      ) {
        return 0;
      }

      return false;
    };
    state.boids.setAvoidWalls({
      hitsWall,
      lookAhead: config.behaviours.avoidWallsLookAhead,
      emergency: new Vector(width / 2, height / 2),
      weight: config.behaviours.avoidWallsWeight
    });

    state.boids.minVelocity = config.boids.minVelocity;
    state.boids.maxVelocity = config.boids.maxVelocity;
    state.boids.maxForce = config.boids.maxForce;

    state.boids.neighbourDistance = config.neighbours.distance;

    const boidCountOffset = config.boids.count - state.boids.vehicles.length;
    if (boidCountOffset > 0) {
      for (let i = 0; i < boidCountOffset; i++) {
        state.boids.addVehicle(newBoid(width, height));
      }
    } else if (boidCountOffset < 0) {
      for (let i = 0; i > boidCountOffset; i--) {
        state.boids.popVehicle();
      }
    }
  }

  ctx.clearRect(0, 0, width, height);

  for (const boid of state.boids.getVehicles()) {
    boid.step(1 / 60, delta / 1000, 3);

    ctx.beginPath();
    const boidSize = 15;
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
