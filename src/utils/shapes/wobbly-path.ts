import Vector from '../vector';
import * as math from '../maths';

interface Config {
  segmentLength: number;
  biasToPerfect: number;
  randomFactor: number;
  roundFactor?: number;
}

export function getNextPoint(
  pointA: Vector,
  pointB: Vector | undefined,
  headFrom: Vector,
  headTowards: Vector,
  config: Config
) {
  // This is the perfect direction: also, a boring straight line
  const perfect = headFrom.sub(headTowards);
  const currentDirection = pointB && pointB.sub(pointA);

  let newDirection = perfect;
  if (currentDirection) {
    // This carries on most in the direction the line is currently going, but
    // skews it a little bit back towards the point it's supposed to be going
    // so that it's not too over the top
    newDirection = Vector.average(
      perfect.setMagnitude(config.biasToPerfect),
      currentDirection.setMagnitude(1 - config.biasToPerfect)
    );
  }

  newDirection = newDirection
    .setMagnitude(config.segmentLength)
    .randomiseByFactor(config.randomFactor);

  return new Vector(
    math.round((pointB ?? pointA).x + newDirection.x, config.roundFactor),
    math.round((pointB ?? pointA).y + newDirection.y, config.roundFactor)
  );
}

/**
 * Generates a slightly wobbly path between two coordinates. The amount of
 * wobbliness can be changed by tweaking the above constants.
 */
export default function generatePath(points: Vector[], config: Config) {
  if (points.length < 2) {
    throw new Error('There must be at least two points in the path');
  }

  const start = points[0];
  const path: Vector[] = [start];

  // Safety to avoid crashing browsers
  let maxRuns = 1000;
  let lastDist = Infinity;

  for (const headTowards of points.slice(1)) {
    do {
      let newPoint;
      if (path.length === 1) {
        newPoint = getNextPoint(start, undefined, headTowards, start, config);
      } else {
        newPoint = getNextPoint(
          path[path.length - 2],
          path[path.length - 1],
          headTowards,
          start,
          config
        );
      }

      path.push(newPoint);

      const dist = newPoint.distTo(headTowards);
      if (dist < config.segmentLength || dist > lastDist) {
        break;
      }
      lastDist = dist;
    } while (maxRuns--);
  }

  return path;
}
