export default function svgPathToPoints(shape: string, resolution = 100) {
  const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  pathEl.setAttribute('d', shape);

  const points: [number, number][] = [];

  const length = pathEl.getTotalLength();
  const segmentLength = length / resolution;
  for (let i = 0; i < length; i += segmentLength) {
    const point = pathEl.getPointAtLength(i);
    points.push([point.x, point.y]);
  }

  if (shape.trim().endsWith('Z')) {
    points.push(points[0]);
  }

  return points;
}
