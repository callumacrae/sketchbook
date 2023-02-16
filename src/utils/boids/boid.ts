import Vector from '../vector';
import HasBehaviours from './mixins/has-behaviours';
import type BoidGroup from './boid-group';

export interface BoidOptions {
  position?: Vector;
  velocity?: Vector;

  maxVelocity?: number;
  maxForce?: number;

  linearDamping?: number;
}

export default class Boid extends HasBehaviours {
  position: Vector = new Vector(0, 0);
  velocity: Vector = new Vector(0, 0);

  maxVelocity: number = 800;
  maxForce: number = 1600;

  linearDamping: number = 0.1;

  group?: BoidGroup;

  constructor(options: BoidOptions) {
    super();

    if (options.position) this.position = options.position;
    if (options.velocity) this.velocity = options.velocity;

    if (options.maxVelocity) this.maxVelocity = options.maxVelocity;
    if (options.maxForce) this.maxForce = options.maxForce;

    if (options.linearDamping) this.linearDamping = options.linearDamping;
  }

  step(dt: number, timeSinceLastCalled?: number, maxSubSteps = 10) {
    if (timeSinceLastCalled !== undefined) {
      const timeToStep = Math.min(timeSinceLastCalled, maxSubSteps * dt);
      this.step(timeToStep);
      return;
    }

    let force = new Vector(0, 0);

    const seekBehaviour = this.behaviours.seek || this.group?.behaviours.seek;
    if (seekBehaviour) {
      const { target, weight } = seekBehaviour;
      const desired = target.sub(this.position).setMagnitude(this.maxVelocity);
      const seekForce = desired.sub(this.velocity);
      force = force.add(seekForce.scale(weight));
    }

    force = force.limit(this.maxForce);

    const linearDamping = Math.pow(1 - this.linearDamping, dt);
    this.velocity = this.velocity.add(force.scale(dt)).scale(linearDamping).limit(this.maxVelocity);
    this.position = this.position.add(this.velocity.scale(dt));
  }
}
