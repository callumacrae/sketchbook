import SimplexNoise from 'simplex-noise';

import * as random from '@/utils/random';
import Vector from '@/utils/vector';
import TweakpanePlugin from '@/utils/plugins/tweakpane';
import type { SketchConfig, InitFn, FrameFn } from '@/utils/renderers/vanilla';

export const meta = {
  name: 'Flow field doughnut 2D',
  date: '2023-03-18',
  tags: ['Canvas 2D', 'Particles', 'Flow field'],
};

export interface CanvasState {
  simplex: SimplexNoise;
  particles: Particle[];
}

interface Particle {
  position: Vector;
  velocity: Vector;
}

const userConfig = {
  particles: 20,
  debugArrows: false,
  resolution: 30,
  variance: 0.6,
  noiseInPosFactor: 0.01,
  noiseInTimeFactor: 0.0008,
  acceleration: 0.2,
  lookAhead: 5,
};
export type UserConfig = typeof userConfig;

const tweakpanePlugin = new TweakpanePlugin<CanvasState, UserConfig>(
  ({ pane, config }) => {
    pane.addInput(config, 'particles', { min: 1, max: 1000, step: 1 });
    pane.addInput(config, 'debugArrows');
    pane.addInput(config, 'resolution', { min: 10, max: 100 });
    pane.addInput(config, 'variance', { min: 0, max: Math.PI });
    pane.addInput(config, 'noiseInPosFactor', { min: 0, max: 0.1 });
    pane.addInput(config, 'noiseInTimeFactor', { min: 0, max: 0.001 });
    pane.addInput(config, 'acceleration', { min: 0, max: 1 });
    pane.addInput(config, 'lookAhead', { min: 0, max: 20 });
  }
);

export const sketchConfig: Partial<SketchConfig<CanvasState, UserConfig>> = {
  userConfig,
  plugins: [tweakpanePlugin],
};

export const initParticles = (props: {
  width: number;
  height: number;
  userConfig: UserConfig;
  state?: { particles: Particle[] };
}) => {
  const { userConfig } = props;
  const particles = props.state?.particles ?? [];

  if (particles.length >= userConfig.particles) {
    return particles.slice(0, userConfig.particles);
  }

  for (let i = particles.length; i < userConfig.particles; i++) {
    particles.push({
      position: new Vector(
        random.range(0, props.width),
        random.range(0, props.height)
      ),
      velocity: new Vector(0, 0),
    });
  }

  return particles;
};

export const init: InitFn<CanvasState, UserConfig> = (props) => {
  return {
    simplex: new SimplexNoise(),
    particles: initParticles(props),
  };
};

export const frame: FrameFn<CanvasState, UserConfig> = ({
  ctx,
  state,
  userConfig,
  width,
  height,
  timestamp,
  hasChanged,
}) => {
  if (!ctx) throw new Error('???');

  if (hasChanged) {
    state.particles = initParticles({ width, height, userConfig, state });
  }

  ctx.clearRect(0, 0, width, height);

  const innerRing = Math.min(width, height) / 10;
  const outerRing = Math.min(width, height) / 2.5;

  ctx.fillStyle = '#d5d5d5';
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, outerRing, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, innerRing, 0, Math.PI * 2);
  ctx.fill();

  const { resolution, variance } = userConfig;

  ctx.fillStyle = 'black';

  function angleForCoords(x: number, y: number) {
    const distFromCenter = Math.sqrt(
      (x - width / 2) ** 2 + (y - height / 2) ** 2
    );

    const angle = Math.atan2(y - height / 2, x - width / 2) - Math.PI / 2;

    // This ensures that the field never points out of the circle
    const angleOffset =
      (variance / 2) *
      (0.5 - (distFromCenter - innerRing) / (outerRing - innerRing));

    const noise =
      (state.simplex.noise3D(
        x * userConfig.noiseInPosFactor,
        y * userConfig.noiseInPosFactor,
        timestamp * userConfig.noiseInTimeFactor
      ) *
        variance) /
      2;

    return angle + angleOffset + noise;
  }

  if (userConfig.debugArrows) {
    for (let x = resolution / 4; x < width; x += resolution) {
      for (let y = resolution / 2; y < height; y += resolution) {
        const distFromCenter = Math.sqrt(
          (x - width / 2) ** 2 + (y - height / 2) ** 2
        );
        if (distFromCenter < innerRing || distFromCenter > outerRing) {
          ctx.strokeStyle = ctx.fillStyle = '#d5d5d5';
        } else {
          ctx.strokeStyle = ctx.fillStyle = '#9294a0';
        }

        const lineLength = resolution * 0.8;

        ctx.translate(x, y);
        ctx.rotate(angleForCoords(x, y));
        ctx.beginPath();
        ctx.moveTo(lineLength / -2, 0);
        ctx.lineTo(lineLength / 2, 0);
        ctx.stroke();

        const arrowSize = lineLength / 4;
        ctx.beginPath();
        ctx.moveTo(lineLength / 2, 0);
        ctx.lineTo(lineLength / 2 - arrowSize, arrowSize / 2);
        ctx.lineTo(lineLength / 2 - arrowSize, -arrowSize / 2);
        ctx.fill();

        ctx.resetTransform();
      }
    }
  }

  for (const particle of state.particles) {
    const { position, velocity } = particle;

    const potentialFuturePosition = position.add(
      velocity.scale(userConfig.lookAhead)
    );

    const idealVelocity = Vector.fromAngle(
      angleForCoords(potentialFuturePosition.x, potentialFuturePosition.y),
      resolution / 2
    );

    const newVelocity = velocity
      .scale(1 - userConfig.acceleration)
      .add(idealVelocity.scale(userConfig.acceleration));
    particle.velocity = newVelocity;
    particle.position = position.add(newVelocity);

    ctx.fillStyle = 'red';
    ctx.beginPath();
    ctx.arc(particle.position.x, particle.position.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
};
