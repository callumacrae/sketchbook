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
