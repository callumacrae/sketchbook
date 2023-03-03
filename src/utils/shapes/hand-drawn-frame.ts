import * as random from '../random';

export type Point = [number, number];

export function makeFrame(
  width: number,
  height: number,
  resolution = 16,
  wiggle = 2
): Point[] {
  function makeXLine(x1: number, x2: number, y: number): Point[] {
    const points: Point[] = [[x1, y]];

    const steps = Math.floor(Math.abs(x2 - x1) / resolution);
    const step = x1 < x2 ? resolution : -resolution;

    for (let i = 1; i < steps; i++) {
      const x = x1 + i * step;
      points.push([x, y + random.range(-wiggle, wiggle)]);
    }

    points.push([x2, y]);
    return points;
  }

  function makeYLine(x: number, y1: number, y2: number): Point[] {
    const points: Point[] = [[x, y1]];

    const steps = Math.floor(Math.abs(y2 - y1) / resolution);
    const step = y1 < y2 ? resolution : -resolution;

    for (let i = 1; i < steps; i++) {
      const y = y1 + i * step;
      points.push([x + random.range(-wiggle, wiggle), y]);
    }

    points.push([x, y2]);
    return points;
  }

  const points: Point[] = [];
  points.push(...makeXLine(0, width, 0));
  points.push(...makeYLine(width, 0, height));
  points.push(...makeXLine(width, 0, height));
  points.push(...makeYLine(0, height, 0));
  return points;
}

export function drawFrame(options: {
  width: number;
  height: number;
  lineWidth?: number;
  resolution?: number;
  wiggle?: number;
}) {
  const { width, height, lineWidth = 5, resolution = 16, wiggle = 2 } = options;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('???');

  ctx.canvas.width = width;
  ctx.canvas.height = height;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const points = makeFrame(width, height, resolution, wiggle);

  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(...points[i]);
  }
  ctx.closePath();
  ctx.stroke();
}

export default {};