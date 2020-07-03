<template>
  <canvas width="1000" height="1000"></canvas>
</template>

<script>
import SimplexNoise from 'simplex-noise';

const simplex = new SimplexNoise();

const DEBUG = false;

export default {
  data: () => ({
    i: 0
  }),
  mounted() {
    const canvas = this.$el;
    this.ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    this.width = rect.width * window.devicePixelRatio;
    this.height = rect.height * window.devicePixelRatio;
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    this.frame();
  },
  beforeDestroy() {
    cancelAnimationFrame(this.frameId);
  },
  methods: {
    frame() {
      this.i++;
      this.ctx.clearRect(0, 0, this.width, this.height);
      if (DEBUG) {
        const imageData = this.generateImageData();
        this.ctx.putImageData(imageData, 0, 0);
      }

      this.drawContours();

      if (!DEBUG) {
        this.frameId = requestAnimationFrame(this.frame);
      }
    },
    generateImageData() {
      const colorGenerator = x => {
        if (x < -0.33) {
          return [255, 0, 0];
        }

        if (x < 0.33) {
          return [0, 255, 0];
        }

        return [0, 0, 255];
      };
      const imageData = this.ctx.createImageData(this.width, this.height);

      const size = this.width * this.height;
      for (let i = 0; i < size; i++) {
        const stride = i * 4;

        const x = i % this.width;
        const y = Math.floor(i / this.height);
        const noise = this.noiseAt(x, y);

        const color = colorGenerator(noise);
        imageData.data[stride] = color[0];
        imageData.data[stride + 1] = color[1];
        imageData.data[stride + 2] = color[2];
        imageData.data[stride + 3] = 66;
      }

      return imageData;
    },
    noiseAt(x, y, z = this.i) {
      const xScale = 1 / 200;
      const yScale = 1 / 500;
      const zScale = 1 / 400;

      return simplex.noise3D(x * xScale, y * yScale, z * zScale);
    },
    drawContours() {
      // Resolution - grid height and width
      const resolution = 20;

      const hitsThreshold = value => value > 0.33;

      const searchEdge = ([x1, y1, x2, y2]) => {
        const noise1 = this.noiseAt(x1, y1);
        const noise2 = this.noiseAt(x2, y2);
        const changes = hitsThreshold(noise1) !== hitsThreshold(noise2);

        if (DEBUG) {
          this.ctx.strokeStyle = changes ? 'black' : 'white';
          this.ctx.beginPath();
          this.ctx.moveTo(x1 / 2, y1 / 2);
          this.ctx.lineTo(x2 / 2, y2 / 2);
          this.ctx.stroke();
        }

        if (changes) {
          // Approximate position - efficiency is more important than accuracy
          // NOTE: this might break if noise algorithm changed or resolution too high
          const distance = (0.33 - noise1) / (noise2 - noise1);
          const positionX = (x2 - x1) * distance + x1;
          const positionY = (y2 - y1) * distance + y1;

          if (DEBUG) {
            this.ctx.fillStyle = 'red';
            this.ctx.fillRect(positionX / 2, positionY / 2, 2, 2);
          }

          return [positionX, positionY];
        }
      };

      let emergency = 1e5;
      const searched = new Set();
      const contours = [];

      for (let x = 0; x < this.width; x += resolution) {
        for (let y = 0; y < this.height; y += resolution) {
          const firstEdge = [[x, y, x + resolution, y], 'up'];

          // This means it's already in a shape
          const alreadySearched = searched.has(firstEdge[0].join(','));
          if (alreadySearched) {
            continue;
          }

          const contour = searchEdge(firstEdge[0]);

          if (!contour) {
            continue;
          }

          let currentEdge = firstEdge;
          const edges = [];
          edges.push([...currentEdge[0], ...contour]);

          const aryEqual = (ary1, ary2) =>
            ary1.length === ary2.length &&
            ary1.every((val, i) => val === ary2[i]);

          do {
            const direction = currentEdge[1];

            const edgesToSearch = (() => {
              const [x1, y1, x2, y2] = currentEdge[0];

              if (direction === 'up') {
                return [
                  [[x1, y1 - resolution, x1, y1], 'left'],
                  [[x1, y1 - resolution, x2, y2 - resolution], 'up'],
                  [[x2, y2 - resolution, x2, y2], 'right']
                ];
              }

              if (direction === 'right') {
                return [
                  [[x1, y1, x1 + resolution, y1], 'up'],
                  [[x1 + resolution, y1, x2 + resolution, y2], 'right'],
                  [[x2, y2, x2 + resolution, y2], 'down']
                ];
              }

              if (direction === 'down') {
                return [
                  [[x2, y2, x2, y2 + resolution], 'right'],
                  [[x1, y1 + resolution, x2, y2 + resolution], 'down'],
                  [[x1, y1, x1, y1 + resolution], 'left']
                ];
              }

              if (direction === 'left') {
                return [
                  [[x2 - resolution, y2, x2, y2], 'down'],
                  [[x1 - resolution, y1, x2 - resolution, y2], 'left'],
                  [[x1 - resolution, y1, x1, y1], 'up']
                ];
              }
            })();

            for (const edge of edgesToSearch) {
              if (emergency-- < 0) {
                throw new Error('Infinite loop!');
              }

              // @todo - we can optimise here if it's < x and <y
              const contour = searchEdge(edge[0]);
              searched.add(edge[0].join(','));

              if (contour) {
                edges.push([...edge[0], ...contour]);
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

      contours.forEach(points => {
        this.ctx.beginPath();
        points.forEach((point, i) => {
          if (!i) {
            this.ctx.moveTo(point[4] / 2, point[5] / 2);
          } else {
            this.ctx.lineTo(point[4] / 2, point[5] / 2);
          }
        });
        this.ctx.lineTo(points[0][4] / 2, points[0][5] / 2);

        if (DEBUG) {
          this.ctx.strokeStyle = 'blue';
          this.ctx.stroke();
        } else {
          this.ctx.fillStyle = 'rgb(0, 20, 20, 0.8)';
          this.ctx.fill();
        }
      });

      // console.log(contours);
    }
  }
};
</script>

<style scoped>
canvas {
  width: 500px;
  height: 500px;
}
</style>
