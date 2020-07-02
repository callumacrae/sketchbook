<template>
  <canvas width="1000" height="1000"></canvas>
</template>

<script>
import SimplexNoise from 'simplex-noise';

const simplex = new SimplexNoise();

const DEBUG = true;

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
      const zScale = 1 / 50;

      return simplex.noise3D(x * xScale, y * yScale, z * zScale);
    },
    drawContours() {
      // Resolution - grid height and width
      const resolution = 20;

      const hitsThreshold = value => value > 0.33;

      const searchEdge = (x1, y1, x2, y2) => {
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

      let emergency = 1e7;
      const toSearch = new Set()
      const contours = [];

      for (let x = 0; x < this.width; x += resolution) {
        for (let y = 0; y < this.height; y += resolution) {
          // @TODO refactor so that this starts out in toSearch
          // UPDATE ON @TODO: doing that makes it well slow.
          const horizontal = searchEdge(x, y, x + resolution, y);
          const vertical = searchEdge(x, y, x, y + resolution);

          if (horizontal || vertical) {
            const localToSearch = new Set()
            const points = [];

            const addPoint = (x1, y1, x2, y2, contourX, contourY) => {
              points.push([x1, y1, x2, y2, contourX, contourY]);

              const maybeToSearch = [
                [x1, y1 - resolution, x1, y1],
                [x1 - resolution, y1, x1, y1],
                [x2, y2, x2, y2 + resolution],
                [x2, y2, x2 + resolution, y2]
              ];

              const isVertical = x1 === x2;
              if (isVertical) {
                maybeToSearch.push(
                  [x1, y1, x1 + resolution, y1],
                  [x2 - resolution, y2, x2, y2],
                  [x1 + resolution, y1, x2 + resolution, y2],
                  [x1 - resolution, y1, x2 - resolution, y2]
                );
              } else {
                maybeToSearch.push(
                  [x1, y1, x1, y1 + resolution],
                  [x2, y2 - resolution, x2, y2],
                  [x1, y1 + resolution, x2, y2 + resolution],
                  [x1, y1 - resolution, x2, y2 - resolution]
                );
              }

              const aryEqual = (ary1, ary2) =>
                ary1.length === ary2.length &&
                ary1.every((val, i) => val === ary2[i]);

              maybeToSearch.forEach(edge => {
                const edgeStr = edge.join(',')
                if (toSearch.has(edgeStr)) {
                  return;
                }

                // toSearch contains everything searched, localToSearch
                // contains just the stuff searched this iteration
                toSearch.add(edgeStr)
                localToSearch.add(edgeStr)
              });
            };

            if (horizontal) {
              addPoint(x, y, x + resolution, y, ...horizontal);
            }
            if (vertical) {
              addPoint(x, y, x, y + resolution, ...vertical);
            }

            // WARNING: localToSearch length changes while loop progresses
            for (const searchStr of localToSearch) {
              if (emergency-- < 0) {
                throw new Error('Infinite loop!');
              }

              const search = searchStr.split(',').map(Number);
              const contour = searchEdge(...search);
              if (contour) {
                addPoint(...search, ...contour);
              }
            }

            if (points.length >= 3) {
              // Check last 10 points - if they're not in order, remove
              // const pointsToCheck = Math.min(10, points.length - 1);
              // for (
              //   let j = points.length - pointsToCheck;
              //   j < points.length;
              //   j++
              // ) {
              //   if (
              //     Math.abs(points[j - 1][0] - points[j][0]) > 20 ||
              //     Math.abs(points[j - 1][1] - points[j][1]) > 20
              //   ) {
              //     points.splice(j, 1);
              //     j--;
              //   }
              // }

              contours.push(points);
            }
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
