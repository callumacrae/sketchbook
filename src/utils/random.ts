import seedRandom from 'seed-random';

let currentRandom: () => number;

export function setSeed(seed: string) {
  // @ts-ignore
  window.randomSeed = seed;

  currentRandom = seedRandom(seed);
}

export function value() {
  if (!currentRandom) {
    const seed = Math.floor(Math.random() * 1e6).toString();
    setSeed(seed);
  }

  return currentRandom();
}

export function range(min: number, max: number) {
  return min + value() * (max - min);
}

export function floorRange(min: number, max: number) {
  return Math.floor(range(min, max));
}

export function roundRange(min: number, max: number) {
  return Math.round(range(min, max));
}

export function pick(ary: any[]) {
  return ary[floorRange(0, ary.length)];
}

export function shuffle(ary: any[], inPlace = true) {
  if (!inPlace) {
    ary = ary.slice();
  }

  for (let i = ary.length - 1; i > 0; i--) {
    const swap = floorRange(0, i + 1);
    // @TODO apparently destructuring this causes performance problems?
    const tmp = ary[i];
    ary[i] = ary[swap];
    ary[swap] = tmp;
  }

  return ary;
}

// Lazy guassian approximation
export function irwinHall(n = 12) {
  let total = 0;

  for (let i = 0; i < n; i++) {
    total += range(-0.5, 0.5);
  }

  return total;
}
