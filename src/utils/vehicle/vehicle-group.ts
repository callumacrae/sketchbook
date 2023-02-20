import HasBehaviours from './mixins/has-behaviours';
import type Vehicle from './vehicle';

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

  popVehicle() {
    const vehicle = this.vehicles.pop();
    if (vehicle) vehicle.group = undefined;
    return vehicle;
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
