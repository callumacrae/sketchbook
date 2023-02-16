import Vector from '../../vector';

export interface BoidBehaviours {
  seek?: { target: Vector; weight: number };
}

export default class HasBehaviours {
  behaviours: BoidBehaviours = {};

  setBehaviours(behaviours: BoidBehaviours) {
    this.behaviours = behaviours;
  }

  setBehaviour<T extends keyof BoidBehaviours>(
    name: T,
    behaviour: BoidBehaviours[T]
  ) {
    this.behaviours[name] = behaviour;
  }

  clearBehaviour(name: keyof BoidBehaviours) {
    delete this.behaviours[name];
  }

  seek(target: Vector | null, weight?: number) {
    if (target === null) {
      this.clearBehaviour('seek');
      return;
    }

    this.setBehaviour('seek', {
      target,
      weight: weight ?? this.behaviours.seek?.weight ?? 1,
    });
  }
}
