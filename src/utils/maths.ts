export function shuffle(array: any[]): any[] {
  let counter = array.length;

  while (counter > 0) {
    const index = Math.floor(Math.random() * counter);
    counter--;

    [array[counter], array[index]] = [array[index], array[counter]];
  }

  return array;
}

export function round(value: number, factor = 0.01): number {
  // The division by the inverse is to help cut down on floating point errors
  return Math.round(value / factor) / (1 / factor);
}

// Only supports linear scales, use d3-scale for more advanced stuff
export function scale(
  domain: [number, number],
  range: [number, number],
  value: number,
  shouldClamp = false
): number {
  const u = (value - domain[0]) / (domain[1] - domain[0]);
  const scaled = range[0] + (range[1] - range[0]) * u;
  return shouldClamp ? clamp(range, scaled) : scaled;
}

export function clamp(range: [number, number], value: number) {
  return Math.max(Math.min(...range), Math.min(value, Math.max(...range)));
}

export function saturate(value: number) {
  return clamp([0, 1], value);
}

// Skypack doesn't like it when there isn't a default export
export default {};
