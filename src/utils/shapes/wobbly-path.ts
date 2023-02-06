import Vector from '../vector';
import * as random from '../random';
import * as math from '../maths';

interface Config {
  segmentLength: number;
  biasToPerfect: number;
  randomFactor: number;
  roundFactor?: number;
}

export function getNextPoint(
  perfectDirection: Vector,
  currentDirection: Vector | undefined,
  fromPoint: Vector,
  config: Config
) {
  let newDirection = perfectDirection;
  if (currentDirection) {
    // This carries on most in the direction the line is currently going, but
    // skews it a little bit back towards the point it's supposed to be going
    // so that it's not too over the top
    newDirection = Vector.average(
      perfectDirection.setMagnitude(config.biasToPerfect),
      currentDirection.setMagnitude(1 - config.biasToPerfect)
    );
  }

  newDirection = newDirection
    .setMagnitude(config.segmentLength)
    .add(
      new Vector(
        random.irwinHall() * config.randomFactor,
        random.irwinHall() * config.randomFactor
      )
    )
    .setMagnitude(config.segmentLength);

  return new Vector(
    math.round(fromPoint.x + newDirection.x, config.roundFactor),
    math.round(fromPoint.y + newDirection.y, config.roundFactor)
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
    const perfect = headTowards.sub(start);

    do {
      let newPoint;
      if (path.length === 1) {
        newPoint = getNextPoint(perfect, undefined, start, config);
      } else {
        const currentDirection = path[path.length - 1].sub(
          path[path.length - 2]
        );
        newPoint = getNextPoint(
          perfect,
          currentDirection,
          path[path.length - 1],
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
