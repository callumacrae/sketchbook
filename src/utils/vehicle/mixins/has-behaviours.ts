import Vector from '../../vector';

export interface BoidBehaviours {
  seek?: { target: Vector; weight?: number };
  flee?: { target: Vector; weight?: number };
}

export default class HasBehaviours {
  behaviours: BoidBehaviours = {};

  setBehaviours(behaviours: BoidBehaviours) {
    this.behaviours = behaviours;
  }

  setBehaviour<T extends keyof BoidBehaviours>(
    name: T,
    behaviour: NonNullable<BoidBehaviours[T]>
  ) {
    this.behaviours[name] = {
      weight: this.behaviours[name]?.weight,
      ...behaviour,
    };
  }

  clearBehaviour(name: keyof BoidBehaviours) {
    delete this.behaviours[name];
  }

  seek(target: Vector | null, weight?: number) {
    if (target === null) {
      this.clearBehaviour('seek');
    } else {
      this.setBehaviour('seek', { target, weight });
    }
  }

  flee(target: Vector | null, weight?: number) {
    if (target === null) {
      this.clearBehaviour('flee');
    } else {
      this.setBehaviour('flee', { target, weight });
    }
  }
}
