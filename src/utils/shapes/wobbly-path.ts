import Vector from '../vector';
import * as math from '../maths';

type Coord = [number, number];

const distBetween = (a: Coord, b: Coord) => {
  const distX = (a[0] - b[0]) ** 2;
  const distY = (a[1] - b[1]) ** 2;
  return (distX + distY) ** 0.5;
};

interface Config {
  SEGMENT_LENGTH: number;
  BIAS_TO_PERFECT: number;
  RANDOM_FACTOR: number;
  ROUND_FACTOR?: number;
}

/**
 * Generates a slightly wobbly path between two coordinates. The amount of
 * wobbliness can be changed by tweaking the above constants.
 */
export default function generatePath(points: Coord[], config: Config) {
  if (points.length < 2) {
    throw new Error('There must be at least two points in the path');
  }

  const start = points[0];
  const path: Coord[] = [start];

  let currentPoint = start;
  let currentDirection: Vector | undefined = undefined;

  // Safety to avoid crashing browsers
  let maxRuns = 1000;

  for (const nextPoint of points.slice(1)) {
    do {
      // This is the perfect direction: also, a boring straight line
      const perfect = Vector.between(currentPoint, nextPoint);

      let newDirection;
      if (currentDirection) {
        // This carries on most in the direction the line is currently going, but
        // skews it a little bit back towards the point it's supposed to be going
        // so that it's not too over the top
        newDirection = Vector.average(
          perfect.setMagnitude(config.BIAS_TO_PERFECT),
          currentDirection.setMagnitude(1 - config.BIAS_TO_PERFECT)
        );
      } else {
        newDirection = perfect;
      }

      newDirection = newDirection
        .setMagnitude(config.SEGMENT_LENGTH)
        .randomiseByFactor(config.RANDOM_FACTOR);

      const newPoint: Coord = [
        math.round(currentPoint[0] + newDirection.x, config.ROUND_FACTOR),
        math.round(currentPoint[1] + newDirection.y, config.ROUND_FACTOR),
      ];

      path.push(newPoint);
      currentPoint = newPoint;
      currentDirection = newDirection;
    } while (
      distBetween(currentPoint, nextPoint) > config.SEGMENT_LENGTH &&
      maxRuns--
    );
  }

  return path;
}
