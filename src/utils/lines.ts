type Coord = [number, number];
type Line = [Coord, Coord];

// Given points (x1, y1) and (x2, y2), returns a and b where y = ax + b
export function solveLine([[x1, y1], [x2, y2]]: Line) {
  const detA = x1 - x2;
  const a = (y1 - y2) / detA;
  const b = y1 - a * x1;

  return [a, b];
}

export function findIntersection(verticalLine: Line, horizontalLine: Line) {
  const [a, b] = solveLine(verticalLine);
  const [c, d] = solveLine(horizontalLine);

  if (!isFinite(a)) {
    const x = verticalLine[0][0];
    const y = c * x + d;
    return [x, y];
  }

  if (!isFinite(c)) {
    return [0, b];
  }

  const x = (d - b) / (a - c);
  const y = a * x + b;
  return [x, y];
}

// Skypack doesn't like it when there isn't a default export
export default {};
