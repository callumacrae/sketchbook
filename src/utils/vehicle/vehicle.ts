import Vector from '../vector';
import HasBehaviours from './mixins/has-behaviours';
import type VehicleGroup from './vehicle-group';

export interface VehicleOptions {
  position?: Vector;
  velocity?: Vector;

  maxVelocity?: number;
  maxForce?: number;

  linearDamping?: number;
}

export default class Vehicle extends HasBehaviours {
  position: Vector = new Vector(0, 0);
  velocity: Vector = new Vector(0, 0);

  maxVelocity: number = 800;
  maxForce: number = 1600;

  linearDamping: number = 0;

  group?: VehicleGroup;

  constructor(options: VehicleOptions) {
    super();

    if (options.position) this.position = options.position;
    if (options.velocity) this.velocity = options.velocity;

    if (options.maxVelocity) this.maxVelocity = options.maxVelocity;
    if (options.maxForce) this.maxForce = options.maxForce;

    if (options.linearDamping) this.linearDamping = options.linearDamping;
  }

  // TODO: specify field of view, customise distance
  getNeighbours() {
    if (!this.group) return [];

    const distance = 200;

    return this.group.vehicles.filter((vehicle) => {
      return (
        vehicle !== this && this.position.distTo(vehicle.position) < distance
      );
    });
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
      force = force.add(seekForce.scale(weight ?? 1));
    }

    const fleeBehaviour = this.behaviours.flee || this.group?.behaviours.flee;
    if (fleeBehaviour) {
      const { target, weight } = fleeBehaviour;
      const desired = this.position.sub(target).setMagnitude(this.maxVelocity);
      const seekForce = desired.sub(this.velocity);
      force = force.add(seekForce.scale(weight ?? 1));
    }

    const separationBehaviour =
      this.behaviours.separation || this.group?.behaviours.separation;
    const cohesionBehaviour =
      this.behaviours.cohesion || this.group?.behaviours.cohesion;
    const alignmentBehaviour =
      this.behaviours.alignment || this.group?.behaviours.alignment;

    if (separationBehaviour || cohesionBehaviour || alignmentBehaviour) {
      const neighbours = this.getNeighbours();

      if (separationBehaviour) {
        const separationForce = neighbours.reduce((acc, neighbour) => {
          const diff = this.position.sub(neighbour.position);
          const desired = diff.setMagnitude(this.maxVelocity);
          const steer = desired.sub(this.velocity);
          return acc.add(steer.scale(1 / diff.length()));
        }, new Vector(0, 0));

        force = force.add(
          separationForce.scale(separationBehaviour.weight ?? 1).scale(10)
        );
      }

      if (cohesionBehaviour) {
        const cohesionForce = neighbours
          .reduce((acc, neighbour) => {
            return acc.add(neighbour.position);
          }, new Vector(0, 0))
          .scale(1 / neighbours.length)
          .sub(this.position)
          .setMagnitude(this.maxVelocity);

        const steer = cohesionForce
          .sub(this.velocity)
          .scale(cohesionBehaviour.weight ?? 1);

        force = force.add(steer);
      }

      if (alignmentBehaviour) {
        const alignmentForce = neighbours
          .reduce((acc, neighbour) => {
            return acc.add(neighbour.velocity);
          }, new Vector(0, 0))
          .scale(0.1 / neighbours.length)
          .normalize()
          .scale(this.maxVelocity);

        const steer = alignmentForce
          .sub(this.velocity)
          .scale(alignmentBehaviour.weight ?? 1).scale(0.1);

        force = force.add(steer);
      }
    }

    force = force.limit(this.maxForce);

    const linearDamping = Math.pow(1 - this.linearDamping, dt);
    this.velocity = this.velocity
      .add(force.scale(dt))
      .scale(linearDamping)
      .limit(this.maxVelocity);
    this.position = this.position.add(this.velocity.scale(dt));
  }
}
