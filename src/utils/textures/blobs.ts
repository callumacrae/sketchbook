import SimplexNoise from 'simplex-noise';

interface Options {
  context: any;
  noise?: SimplexNoise;
  noiseSeed?: string;
  customNoiseAt?: (x: number, y: number, t: number) => number;
  dpr?: number;
  width?: number;
  height?: number;
}

export default class BlobCanvas {
  private readonly context: any;
  private readonly noise?: SimplexNoise;
  private readonly customNoiseAt?: (x: number, y: number, t: number) => number;
  private readonly dpr: number;
  private readonly width: number;
  private readonly height: number;

  private readonly noiseCache: Map<number, Map<number, number>>;

  constructor(options: Options) {
    this.context =
      options.context || document.createElement('canvas').getContext('2d');

    if (options.customNoiseAt) {
      this.customNoiseAt = options.customNoiseAt;
    } else {
      this.noise = options.noise || new SimplexNoise(options.noiseSeed);
    }

    this.dpr = options.dpr || window.devicePixelRatio;

    if (options.width && options.height) {
      this.context.canvas.width = options.width;
      this.context.canvas.height = options.height;

      this.width = options.width * this.dpr;
      this.height = options.height * this.dpr;
    } else {
      const rect = this.context.canvas.getBoundingClientRect();
      this.width = rect.width * this.dpr;
      this.height = rect.height * this.dpr;
    }

    this.context.scale(this.dpr, this.dpr);

    this.noiseCache = new Map();
  }

  getCanvas() {
    return this.context.canvas;
  }

  frame(timestamp = 0) {
    const t = timestamp / 60;

    this.noiseCache.clear();
    this.context.fillStyle = 'white';
    this.context.fillRect(0, 0, this.width, this.height);

    // this.debugNoise(timestamp)

    const contours = this.generateContours(t);

    contours.forEach(points => {
      this.context.beginPath();
      points.forEach((point, i) => {
        if (!i) {
          this.context.moveTo(point[4] / this.dpr, point[5] / this.dpr);
        } else {
          this.context.lineTo(point[4] / this.dpr, point[5] / this.dpr);
        }
      });
      this.context.lineTo(points[0][4] / this.dpr, points[0][5] / this.dpr);

      this.context.fillStyle = 'rgb(0, 20, 20, 0.8)';
      this.context.fill();
    });
  }

  private noiseAt(x: number, y: number, t: number) {
    if (this.customNoiseAt) {
      // @TODO cache this
      return this.customNoiseAt(x, y, t);
    }

    let innerCache = this.noiseCache.get(x);
    if (!innerCache) {
      innerCache = new Map();
      this.noiseCache.set(x, innerCache);
    }

    const cacheItem = innerCache.get(y);
    if (cacheItem) {
      return cacheItem;
    }

    const xScale = 1 / 100;
    const yScale = 1 / 300;
    const tScale = 1 / 200;

    if (!this.noise) {
      // This is just to make typescript happy basically
      throw new Error('Noise undefined')
    }

    const noise = this.noise.noise3D(x * xScale, y * yScale, t * tScale);
    innerCache.set(y, noise);
    return noise;
  }

  debugNoise(t: number) {
    const colorGenerator = (x: number) => {
      if (x < -0.33) {
        return [255, 0, 0];
      }

      if (x < 0.33) {
        return [255, 255, 255];
      }

      return [0, 0, 255];
    };
    const imageData = this.context.createImageData(this.width, this.height);

    const size = this.width * this.height;
    for (let i = 0; i < size; i++) {
      const stride = i * 4;

      const x = i % this.width;
      const y = Math.floor(i / this.height);
      const noise = this.noiseAt(x, y, t);

      const color = colorGenerator(noise);
      imageData.data[stride] = color[0];
      imageData.data[stride + 1] = color[1];
      imageData.data[stride + 2] = color[2];
      imageData.data[stride + 3] = 66;
    }

    this.context.putImageData(imageData, 0, 0)
    return imageData;
  }

  generateContours(t: number) {
    // Resolution - grid height and width
    const resolution = 10;

    const threshold = 0.2
    const hitsThreshold = (value: number) => value > threshold;

    type Point = [number, number];
    type Edge = [number, number, number, number];
    type EdgeAndContour = [number, number, number, number, number, number];
    type Direction = 'up' | 'down' | 'left' | 'right';
    type EdgeAndDirection = [Edge, Direction];

    const searchEdge = ([x1, y1, x2, y2]: Edge): Point | undefined => {
      const noise1 = this.noiseAt(x1, y1, t);
      const noise2 = this.noiseAt(x2, y2, t);
      const changes = hitsThreshold(noise1) !== hitsThreshold(noise2);

      if (changes) {
        // Approximate position - efficiency is more important than accuracy
        // NOTE: this might break if noise algorithm changed or resolution too high
        const distance = (threshold - noise1) / (noise2 - noise1);
        const positionX = (x2 - x1) * distance + x1;
        const positionY = (y2 - y1) * distance + y1;

        return [positionX, positionY];
      }
    };

    let emergency = 1e5;
    const searched = new Set<string>();
    const contours = [];

    for (let x = 0; x < this.width; x += resolution) {
      for (let y = 0; y < this.height; y += resolution) {
        const firstEdge: EdgeAndDirection = [[x, y, x + resolution, y], 'up'];

        // This means it's already in a shape
        const alreadySearched = searched.has(firstEdge[0].join(','));
        if (alreadySearched) {
          continue;
        }

        const contour = searchEdge(firstEdge[0]);

        if (!contour) {
          continue;
        }

        let currentEdge: EdgeAndDirection = firstEdge;
        const edges: EdgeAndContour[] = [];
        edges.push(currentEdge[0].concat(contour) as EdgeAndContour);

        const aryEqual = (ary1: any[], ary2: any[]) =>
          ary1.length === ary2.length &&
          ary1.every((val, i) => val === ary2[i]);

        do {
          const direction = currentEdge[1];

          const edgesToSearch: EdgeAndDirection[] = (() => {
            const [x1, y1, x2, y2] = currentEdge[0];

            if (direction === 'up') {
              return [
                [[x1, y1 - resolution, x1, y1], 'left'],
                [[x1, y1 - resolution, x2, y2 - resolution], 'up'],
                [[x2, y2 - resolution, x2, y2], 'right']
              ] as EdgeAndDirection[];
            }

            if (direction === 'right') {
              return [
                [[x1, y1, x1 + resolution, y1], 'up'],
                [[x1 + resolution, y1, x2 + resolution, y2], 'right'],
                [[x2, y2, x2 + resolution, y2], 'down']
              ] as EdgeAndDirection[];
            }

            if (direction === 'down') {
              return [
                [[x2, y2, x2, y2 + resolution], 'right'],
                [[x1, y1 + resolution, x2, y2 + resolution], 'down'],
                [[x1, y1, x1, y1 + resolution], 'left']
              ] as EdgeAndDirection[];
            }

            return [
              [[x2 - resolution, y2, x2, y2], 'down'],
              [[x1 - resolution, y1, x2 - resolution, y2], 'left'],
              [[x1 - resolution, y1, x1, y1], 'up']
            ] as EdgeAndDirection[];
          })();

          for (const edge of edgesToSearch) {
            if (emergency-- < 0) {
              throw new Error('Infinite loop!');
            }

            const contour = searchEdge(edge[0]);
            searched.add(edge[0].join(','));

            if (contour) {
              edges.push([...edge[0], ...contour] as EdgeAndContour);
              currentEdge = edge;
              break;
            }
          }
        } while (!aryEqual(currentEdge[0], firstEdge[0]));

        if (edges.length >= 3) {
          contours.push(edges);
        }
      }
    }

    return contours;
    // console.log(contours);
  }
}
