import * as random from '../random';
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

  group?: VehicleGroup;

  constructor(options: VehicleOptions) {
    super();

    if (options.position) this.position = options.position;
    if (options.velocity) this.velocity = options.velocity;

    if (options.maxVelocity) this.maxVelocity = options.maxVelocity;
    if (options.maxForce) this.maxForce = options.maxForce;

    if (options.linearDamping) this.linearDamping = options.linearDamping;
  }

  // TODO: specify field of view
  getNeighbours() {
    if (!this.group) return [];

    const distance =
      this.neighbourDistance ?? this.group?.neighbourDistance ?? 200;

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

    const minVelocity = this.minVelocity ?? this.group?.minVelocity ?? 200;
    const maxVelocity = this.maxVelocity ?? this.group?.maxVelocity ?? 400;
    const maxForce = this.maxForce ?? this.group?.maxForce ?? 500;
    const linearDamping = this.linearDamping ?? this.group?.linearDamping ?? 0;

    let force = new Vector(0, 0);

    const seekBehaviour = this.behaviours.seek || this.group?.behaviours.seek;
    if (seekBehaviour) {
      const { target, weight } = seekBehaviour;
      const desired = target.sub(this.position).setMagnitude(maxVelocity);
      const seekForce = desired.sub(this.velocity);
      force = force.add(seekForce.scale(weight ?? 1));
    }

    const fleeBehaviour = this.behaviours.flee || this.group?.behaviours.flee;
    if (fleeBehaviour) {
      const { target, weight } = fleeBehaviour;
      const desired = this.position.sub(target).setMagnitude(maxVelocity);
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

      if (separationBehaviour && neighbours.length) {
        const separationForce = neighbours.reduce((acc, neighbour) => {
          const diff = this.position.sub(neighbour.position);
          const desired = diff.setMagnitude(maxVelocity);
          const steer = desired.sub(this.velocity);
          return acc.add(steer.scale(1 / diff.length()));
        }, new Vector(0, 0));

        force = force.add(
          separationForce.scale(separationBehaviour.weight ?? 1).scale(75)
        );
      }

      if (cohesionBehaviour && neighbours.length) {
        const cohesionForce = neighbours
          .reduce((acc, neighbour) => {
            return acc.add(neighbour.position);
          }, new Vector(0, 0))
          .scale(1 / neighbours.length)
          .sub(this.position)
          .setMagnitude(maxVelocity);

        const steer = cohesionForce
          .sub(this.velocity)
          .scale(cohesionBehaviour.weight ?? 1);

        force = force.add(steer);
      }

      if (alignmentBehaviour && neighbours.length) {
        const alignmentForce = neighbours
          .reduce((acc, neighbour) => {
            return acc.add(neighbour.velocity);
          }, new Vector(0, 0))
          .scale(0.1 / neighbours.length)
          .normalize()
          .scale(maxVelocity);

        const steer = alignmentForce
          .sub(this.velocity)
          .scale(alignmentBehaviour.weight ?? 1);

        force = force.add(steer);
      }
    }

    const avoidWallsBehaviour =
      this.behaviours.avoidWalls || this.group?.behaviours.avoidWalls;
    if (avoidWallsBehaviour) {
      const { hitsWall, lookAhead = 0.1, weight } = avoidWallsBehaviour;

      // WARNING WHEN IMPLEMENTING hitsWall FUNCTION:
      // `ahead` is _relative_ to `current`
      const lookAheadVector = this.velocity.scale(lookAhead);

      const rotateVal = 0.1;

      const collides = hitsWall(this.position, lookAheadVector);
      if (collides !== false) {
        let foundPerfect = false;

        let bestCollisionValue = Infinity;
        let bestCollisionRotation: number | null = null;

        for (let i = 0; i < Math.PI / 1.2 / rotateVal; i++) {
          const posCollides = hitsWall(
            this.position,
            lookAheadVector.rotate(rotateVal * i)
          );
          if (posCollides === false) {
            force = force.add(
              lookAheadVector
                .rotate(Math.min(Math.PI / 2, rotateVal * i * 4))
                .scale(1 / Math.pow(collides, 2))
                .scale(weight ?? 1)
            );
            foundPerfect = true;
            break;
          } else if (posCollides !== 0 && posCollides < bestCollisionValue) {
            bestCollisionValue = posCollides;
            bestCollisionRotation = rotateVal * i;
          }

          const negCollides = hitsWall(
            this.position,
            lookAheadVector.rotate(-rotateVal * i)
          );
          if (negCollides === false) {
            force = force.add(
              lookAheadVector
                .rotate(-Math.min(Math.PI / 2, rotateVal * i * 4))
                .scale(1 / Math.pow(collides, 2))
                .scale(weight ?? 1)
            );
            foundPerfect = true;
            break;
          } else if (negCollides !== 0 && negCollides < bestCollisionValue) {
            bestCollisionValue = negCollides;
            bestCollisionRotation = -rotateVal * i;
          }
        }

        if (!foundPerfect) {
          if (bestCollisionRotation !== null) {
            force = force.add(
              lookAheadVector.rotate(bestCollisionRotation).scale(weight ?? 1)
            );
          } else {
            // If it's totally lost, head to emergency point
            const centerOffset = (
              avoidWallsBehaviour.emergency ?? new Vector(0, 0)
            ).sub(this.position);
            force = force.add(centerOffset.scale(weight ?? 1));
          }
        }
      }
    }

    const wanderBehaviour =
      this.behaviours.wander || this.group?.behaviours.wander;
    if (wanderBehaviour) {
      const wanderForce = this.velocity
        .rotate(random.range(-2, 2))
        .scale(wanderBehaviour.weight ?? 1);
      force = force.add(wanderForce);
    }

    force = force.limit(maxForce);

    this.velocity = this.velocity
      .add(force.scale(dt))
      .scale(Math.pow(1 - linearDamping, dt))
      .limit(maxVelocity);

    if (this.velocity.length() < minVelocity) {
      this.velocity = this.velocity.setMagnitude(minVelocity);
    }

    this.position = this.position.add(this.velocity.scale(dt));
  }
}
