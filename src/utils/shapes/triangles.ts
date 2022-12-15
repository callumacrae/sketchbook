/**
 *      /\
 *     A   B=A
 *    /__C__\
 */
export function randomEquilateral(
  centroid: { x: number; y: number },
  A: number
) {
  // const A = 50 + Math.random() * 20;
  // const C = 40 + Math.random() * 40;

  const C = A * 0.8;

  if (!centroid) {
    centroid = {
      x: 100 + Math.random() * 400,
      y: 100 + Math.random() * 400,
    };
  }

  const height = Math.sqrt(A ** 2 - (C / 2) ** 2);

  const a = [centroid.x + C / 2, centroid.y + height / 2];
  const b = [centroid.x - C / 2, centroid.y + height / 2];
  const c = [centroid.x, centroid.y - height / 2];

  return `M ${a.join(' ')} L ${b.join(' ')} L ${c.join(' ')} Z`;
}
