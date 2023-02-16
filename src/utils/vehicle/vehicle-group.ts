import Vehicle from './vehicle';
import HasBehaviours from './mixins/has-behaviours';

export default class VehicleGroup extends HasBehaviours {
  vehicles: Vehicle[] = [];

  constructor(vehicles?: Vehicle[]) {
    super();
    if (vehicles) this.vehicles = vehicles;
  }

  addVehicle(vehicle: Vehicle) {
    this.vehicles.push(vehicle);
    vehicle.group = this;
  }

  removeVehicle(vehicle: Vehicle) {
    const index = this.vehicles.indexOf(vehicle);
    if (index > -1) {
      this.vehicles.splice(index, 1);
      vehicle.group = undefined;
    } else {
      throw new Error('Vehicle not found in group');
    }
  }

  getVehicles() {
    return this.vehicles;
  }

  step(dt: number, timeSinceLastCalled?: number, maxSubSteps = 10) {
    for (const vehicle of this.vehicles) {
      vehicle.step(dt, timeSinceLastCalled, maxSubSteps);
    }
  }
}
