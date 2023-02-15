import Vector from './vector';
import { saturate } from './maths';

type MaybeVector = Vector | [number, number];
const ensureVector = (v: MaybeVector): Vector => {
  return v instanceof Vector ? v : new Vector(v[0], v[1]);
};

export default class Line {
  a: Vector;
  b: Vector;

  constructor(from: MaybeVector, to: MaybeVector) {
    this.a = ensureVector(from);
    this.b = ensureVector(to);
  }

  distToPoint(point: MaybeVector) {
    const pointVector = ensureVector(point);
    const ab = this.b.sub(this.a);
    const ac = pointVector.sub(this.a);

    const t = ac.dot(ab) / ab.dot(ab);
    if (t < 0) return ac.length();
    if (t > 1) return pointVector.sub(this.b).length();

    const proj = this.a.add(ab.scale(t));
    return pointVector.sub(proj).length();
  }

  direction() {
    return this.b.sub(this.a);
  }

  distToLine(other: Line) {
    const ab = this.direction();
    const cd = other.direction();

    const a = this.a;
    const b = this.b;
    const c = other.a;
    const d = other.b;

    const thisIntersection =
      (cd.x * (a.y - c.y) + cd.y * (c.x - a.x)) / (ab.x * cd.y - ab.y * cd.x);
    const otherIntersection =
      (ab.x * (c.y - a.y) + ab.y * (a.x - c.x)) / (cd.x * ab.y - cd.y * ab.x);

    // It's the same line
    if (isNaN(thisIntersection) || isNaN(otherIntersection)) {
      return 0;
    }

    if (thisIntersection === Infinity || thisIntersection === -Infinity) {
      const minXDist = Math.min(
        ...[a.x - c.x, a.x - d.x, b.x - c.x, b.x - d.x].map(Math.abs)
      );
      const minYDist = Math.min(
        ...[a.y - c.y, a.y - d.y, b.y - c.y, b.y - d.y].map(Math.abs)
      );
      return Math.sqrt(minXDist * minXDist + minYDist * minYDist);
    }

    if (
      saturate(thisIntersection) === thisIntersection &&
      saturate(otherIntersection) === otherIntersection
    ) {
      return 0;
    }

    return Math.min(
      other.distToPoint(a),
      other.distToPoint(b),
      this.distToPoint(c),
      this.distToPoint(d)
    );
  }

  bounds() {
    return {
      topLeft: new Vector(
        Math.min(this.a.x, this.b.x),
        Math.min(this.a.y, this.b.y)
      ),
      bottomRight: new Vector(
        Math.max(this.a.x, this.b.x),
        Math.max(this.a.y, this.b.y)
      ),
    };
  }

  static fromAngle(center: Vector, angle: number, length: number) {
    const direction = Vector.fromAngle(angle);
    const a = center.add(direction.scale(-length / 2));
    const b = center.add(direction.scale(length / 2));
    return new Line(a, b);
  }
}
