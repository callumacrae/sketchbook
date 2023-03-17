import SimplexNoise from 'simplex-noise';

interface NoiseGenerator {
  get(x: number): number;
}

export interface NoiseMachineOptions {
  simplex: SimplexNoise;
}

export default class NoiseMachine implements NoiseGenerator {
  private noises: NoiseGenerator[] = [];

  add(noise: NoiseGenerator) {
    this.noises.push(noise);
    return this;
  }

  get(x: number) {
    let noiseAtX = 0;

    for (const noise of this.noises) {
      noiseAtX += noise.get(x);
    }

    return noiseAtX;
  }
}

type ResolvableValue = number | NoiseGenerator | ((x: number) => number);
const resolveVal = (value: ResolvableValue, x: number) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'function') return value(x);
  return value.get(x);
};

export interface SimplexNoiseGeneratorOptions {
  simplex?: SimplexNoise;
  inputFactor?: ResolvableValue;
  range?: [ResolvableValue, ResolvableValue];
  factor?: ResolvableValue;
  // x is a value between 0 and 1
  easing?: (x: number) => number;
}
export class SimplexNoiseGenerator implements NoiseGenerator {
  private simplex: SimplexNoise;
  private options: Omit<Required<SimplexNoiseGeneratorOptions>, 'simplex'>;

  private noiseSeed = Math.random() * 1e6;

  constructor(options?: SimplexNoiseGeneratorOptions) {
    this.simplex = options?.simplex || new SimplexNoise();

    this.options = Object.assign(
      {
        inputFactor: 1,
        range: [-1, 1],
        factor: 1,
        easing: (x: number) => x,
      },
      options
    );
  }

  get(x: number) {
    const inputFactor = resolveVal(this.options.inputFactor, x);

    let value = this.simplex.noise2D(x * inputFactor, this.noiseSeed) / 2 + 0.5;
    value = this.options.easing(value);

    if (Array.isArray(this.options.range)) {
      const min = resolveVal(this.options.range[0], x);
      const max = resolveVal(this.options.range[1], x);
      value = value * (max - min) + min;
    } else {
      value = value * 2 - 1;
    }

    value *= resolveVal(this.options.factor, x);

    return value;
  }
}

export interface BandedNoiseGeneratorOptions {
  range?: [ResolvableValue, ResolvableValue];
  factor?: ResolvableValue;
  // x is a value between 0 and 1
  easing?: (x: number) => number;

  bandFreqency: ResolvableValue;
  bandSize: ResolvableValue;
  bandSizeType?: 'absolute' | 'percentage';
}
export class BandedNoiseGenerator implements NoiseGenerator {
  private options: Required<BandedNoiseGeneratorOptions>;

  constructor(options?: BandedNoiseGeneratorOptions) {
    this.options = Object.assign(
      {
        range: [0, 1],
        factor: 1,
        easing: (x: number) => x,
        bandSizeType: 'absolute',
      },
      options
    );
  }

  get(x: number) {
    const bandFrequency = resolveVal(this.options.bandFreqency, x);
    const bandSizeUntyped = resolveVal(this.options.bandSize, x);
    const bandSize =
      this.options.bandSizeType === 'percentage'
        ? bandSizeUntyped * bandFrequency
        : bandSizeUntyped;

    const distFromBand = Math.abs(
      x - Math.round(x / bandFrequency) * bandFrequency
    );
    let value = 0;
    if (distFromBand < bandSize) {
      value = (bandSize - distFromBand) / bandSize;
    }

    value = this.options.easing(value);

    if (Array.isArray(this.options.range)) {
      const min = resolveVal(this.options.range[0], x);
      const max = resolveVal(this.options.range[1], x);
      value = value * (max - min) + min;
    } else {
      value = value * 2 - 1;
    }

    value *= resolveVal(this.options.factor, x);

    return value;
  }
}

export interface SineGeneratorOptions {
  inputFactor?: ResolvableValue;
  range?: [ResolvableValue, ResolvableValue];
  factor?: ResolvableValue;
  // x is a value between 0 and 1
  easing?: (x: number) => number;
}
export class SineGenerator implements NoiseGenerator {
  private options: Required<SineGeneratorOptions>;

  constructor(options?: SineGeneratorOptions) {
    this.options = Object.assign(
      {
        inputFactor: 1,
        range: [-1, 1],
        factor: 1,
        easing: (x: number) => x,
      },
      options
    );
  }

  get(x: number) {
    const inputFactor = resolveVal(this.options.inputFactor, x);

    let value = Math.sin(x * inputFactor) / 2 + 0.5;
    value = this.options.easing(value);

    if (Array.isArray(this.options.range)) {
      const min = resolveVal(this.options.range[0], x);
      const max = resolveVal(this.options.range[1], x);
      value = value * (max - min) + min;
    } else {
      value = value * 2 - 1;
    }

    value *= resolveVal(this.options.factor, x);

    return value;
  }
}
