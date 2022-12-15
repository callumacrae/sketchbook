import * as random from './random';

export default class Vector {
  ax: number;
  ay: number;

  constructor(ax: number, ay: number) {
    this.ax = ax;
    this.ay = ay;
  }

  getMagnitude() {
    return Math.pow(Math.pow(this.ax, 2) + Math.pow(this.ay, 2), 0.5);
  }

  /**
   * Returns a new vector with a specified magnitude.
   *
   * @param newMagnitude The magnitude of the new vector.
   */
  restrictMagnitude(newMagnitude: number) {
    const ratio = newMagnitude / this.getMagnitude();
    return new Vector(this.ax * ratio, this.ay * ratio);
  }

  toArray() {
    return [this.ax, this.ay];
  }

  /**
   * Changes a vector slightly by a random amount. Uses a random function with a
   * normal distribution, so it's usually not that different.
   *
   * @param factor Standard deviation of the normal distribution function used.
   */
  randomiseByFactor(factor = 1) {
    return new Vector(
      this.ax + random.irwinHall() * factor,
      this.ay + random.irwinHall() * factor
    );
  }

  /**
   * Calculates the vector between two coordinates
   *
   * @param from Coordinate to calculate vector from
   * @param to Coordinate to calculate vector to
   */
  static between(from: [number, number], to: [number, number]) {
    return new Vector(to[0] - from[0], to[1] - from[1]);
  }

  /**
   * Returns the average of n vectors.
   *
   * @param vectors One or more vectors.
   */
  static average(...vectors: Vector[]) {
    const ax = vectors.reduce((sum, { ax }) => sum + ax, 0) / vectors.length;
    const ay = vectors.reduce((sum, { ay }) => sum + ay, 0) / vectors.length;

    return new Vector(ax, ay);
  }

  /**
   * Generates a random vector going < 0.5 on the x and y axes.
   */
  static random() {
    return new Vector(random.range(-0.5, 0.5), random.range(-0.5, 0.5));
  }

  /**
   * Generate a vector from the direction and magnitude instead of from the
   * components.
   *
   * @param direction Direction in radians.
   * @param magnitude Magnitude of the vector.
   */
  static fromDirection(direction: number, magnitude = 1) {
    const ax = magnitude * Math.cos(direction);
    const ay = magnitude * Math.sin(direction);
    return new Vector(ax, ay);
  }
}
