export default class Vector {
  x: number;
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  length() {
    return Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2));
  }

  toArray() {
    return [this.x, this.y];
  }

  add(other: Vector) {
    return new Vector(this.x + other.x, this.y + other.y);
  }

  sub(other: Vector) {
    return new Vector(this.x - other.x, this.y - other.y);
  }

  dot(other: Vector) {
    return this.x * other.x + this.y * other.y;
  }

  scale(factor: number) {
    return new Vector(this.x * factor, this.y * factor);
  }

  rotate(angle: number) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return new Vector(this.x * c - this.y * s, this.x * s + this.y * c);
  }

  distTo(other: Vector) {
    return Math.sqrt(
      Math.pow(this.x - other.x, 2) + Math.pow(this.y - other.y, 2)
    );
  }

  setMagnitude(newMagnitude: number) {
    return this.scale(newMagnitude / this.length());
  }

  normalize() {
    return this.setMagnitude(1);
  }

  /**
   * Calculates the vector between two coordinates
   *
   * @deprecated Use vector.sub instead
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
    const x = vectors.reduce((sum, { x: ax }) => sum + ax, 0) / vectors.length;
    const y = vectors.reduce((sum, { y: ay }) => sum + ay, 0) / vectors.length;

    return new Vector(x, y);
  }

  /**
   * Generate a vector from the angle and magnitude instead of from the
   * components.
   *
   * @param angle Angle in radians.
   * @param magnitude Magnitude of the vector.
   */
  static fromAngle(angle: number, magnitude = 1) {
    return new Vector(magnitude * Math.cos(angle), magnitude * Math.sin(angle));
  }
}
