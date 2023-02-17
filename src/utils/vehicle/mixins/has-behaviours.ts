import Vector from '../../vector';

export interface BoidBehaviours {
  seek?: { target: Vector; weight?: number };
  flee?: { target: Vector; weight?: number };
  separation?: { weight?: number };
  cohesion?: { weight?: number };
  alignment?: { weight?: number };
}

export default class HasBehaviours {
  behaviours: BoidBehaviours = {};

  minVelocity: number | undefined;
  maxVelocity: number | undefined;
  maxForce: number | undefined;

  linearDamping: number | undefined;

  neighbourDistance: number | undefined;

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

  setSeek(target: Vector | null, weight?: number) {
    if (target === null) {
      this.clearBehaviour('seek');
    } else {
      this.setBehaviour('seek', { target, weight });
    }
  }

  setFlee(target: Vector | null, weight?: number) {
    if (target === null) {
      this.clearBehaviour('flee');
    } else {
      this.setBehaviour('flee', { target, weight });
    }
  }

  setSeparation(weight: number | null) {
    if (weight === null) {
      this.clearBehaviour('separation');
    } else {
      this.setBehaviour('separation', { weight });
    }
  }

  setCohesion(weight: number | null) {
    if (weight === null) {
      this.clearBehaviour('cohesion');
    } else {
      this.setBehaviour('cohesion', { weight });
    }
  }

  setAlignment(weight: number | null) {
    if (weight === null) {
      this.clearBehaviour('alignment');
    } else {
      this.setBehaviour('alignment', { weight });
    }
  }
}
