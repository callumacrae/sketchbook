import Boid from './boid';
import HasBehaviours from './mixins/has-behaviours';

export default class BoidGroup extends HasBehaviours {
  private boids: Boid[] = [];

  constructor(boids?: Boid[]) {
    super();
    if (boids) this.boids = boids;
  }

  addBoid(boid: Boid) {
    this.boids.push(boid);
    boid.group = this;
  }

  removeBoid(boid: Boid) {
    const index = this.boids.indexOf(boid);
    if (index > -1) {
      this.boids.splice(index, 1);
      boid.group = undefined;
    } else {
      throw new Error('Boid not found in group');
    }
  }

  getBoids() {
    return this.boids;
  }

  step(dt: number, timeSinceLastCalled?: number, maxSubSteps = 10) {
    for (const boid of this.boids) {
      boid.step(dt, timeSinceLastCalled, maxSubSteps);
    }
  }
}
