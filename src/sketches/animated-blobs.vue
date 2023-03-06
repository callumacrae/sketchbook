<template>
  <div class="triangles">
    <canvas
      ref="canvas"
      width="600"
      height="600"
      style="position: absolute"
    ></canvas>
    <svg style="position: absolute">
      <rect
        v-for="(pixel, i) in highlightPixels"
        :width="2"
        :height="2"
        :x="pixel[0]"
        :y="pixel[1]"
        fill="green"
        :key="`highlight-${i}`"
      />

      <path v-for="(shape, i) in shapes" v-bind="shape" :key="`shape-${i}`" />
    </svg>
  </div>
</template>

<script>
import SimplexNoise from 'simplex-noise';

export const meta = {
  name: 'Contour texture v1',
  date: '2020-05-12',
  tags: ['Canvas 2D', 'Noise'],
};

const simplex = new SimplexNoise();

export default {
  data: () => ({
    shapes: [],
    highlightPixels: [],
    z: 0,
  }),
  mounted() {
    this.paint();

    const frame = () => {
      this.z += 0.005;
      this.paint();

      requestAnimationFrame(frame);
    };

    requestAnimationFrame(frame);
  },
  methods: {
    paint() {
      const ctx = this.$refs.canvas.getContext('2d');
      ctx.clearRect(0, 0, 600, 600);
      this.shapes = [];
      this.highlightPixels = [];

      let maxLoops = 1e6;
      const abortLoop = (msg) => {
        if (maxLoops-- < 1) {
          console.error('ABORTING PROBABLE INFINITE LOOP', msg);
          return true;
        }
        return false;
      };

      const xScaleFactor = 1 / 80;
      const yScaleFactor = 1 / 80;

      const width = 6;
      const height = 6;

      // for (let x = 0; x < 600; x += width) {
      //   for (let y = 0; y < 600; y += height) {
      //     if (abortLoop('pixels')) return;

      //     const noise = simplex.noise3D(
      //       x * xScaleFactor,
      //       y * yScaleFactor,
      //       this.z
      //     );

      //     if (noise > 0.66) {
      //       //this.pixels.push({ x, y, width, height, noise });
      //       ctx.fillStyle = `rgba(255, 0, 0, ${(noise - 0.66) * 3})`;
      //       ctx.fillRect(x, y, width, height);
      //     }
      //   }
      // }

      const hotspots = [];

      const isHotspot = (x, y) =>
        simplex.noise3D(x * xScaleFactor, y * yScaleFactor, this.z) > 0.4;

      for (let x = 0; x < 600; x += width) {
        for (let y = 0; y < 600; y += height) {
          if (abortLoop('out hotspot loop')) return;

          if (isHotspot(x, y)) {
            // Check if already in another hotspot - if so, abort
            // @todo room for optimisation again - can skip to end of hotspot
            const alreadyGrouped = hotspots.some((hotspot) =>
              hotspot.find(
                (toSearchItem) => toSearchItem[0] === x && toSearchItem[1] === y
              )
            );

            if (alreadyGrouped) {
              continue;
            }

            const hotspot = [[x, y]];
            const toSearch = [
              [x + width, y],
              [x, y + height],
            ];

            // Heads up, toSearch.length changes mid-loop
            for (let i = 0; i < toSearch.length; i++) {
              if (abortLoop('in hotspot loop')) return;

              const search = toSearch[i];

              if (isHotspot(search[0], search[1])) {
                hotspot.push(search);

                const maybeAdd = (searchNext) => {
                  // @todo room for optimisation here - use a data structure that
                  // we can do .includes() on or something
                  if (
                    !toSearch.find(
                      (toSearchItem) =>
                        toSearchItem[0] === searchNext[0] &&
                        toSearchItem[1] === searchNext[1]
                    )
                  ) {
                    toSearch.push(searchNext);
                  }
                };

                maybeAdd([search[0] + width, search[1]]);
                maybeAdd([search[0] - width, search[1]]);
                maybeAdd([search[0], search[1] + height]);
                maybeAdd([search[0], search[1] - height]);
              }
            }

            hotspots.push(hotspot);
          }
        }
      }

      // hotspots = [hotspots[10]]

      // Find outline of hotspots
      hotspots.forEach((hotspot) => {
        const xValues = new Set(hotspot.map(([x]) => x).sort((a, b) => a - b));
        const borders = [];

        xValues.forEach((x) => {
          const yValuesForX = hotspot
            .filter(([maybeX]) => x === maybeX)
            .map(([_, y]) => y);
          const min = Math.min(...yValuesForX);
          borders.push([x, min]);
        });

        Array.from(xValues)
          .reverse()
          .forEach((x) => {
            const yValuesForX = hotspot
              .filter(([maybeX]) => x === maybeX)
              .map(([_, y]) => y);
            const max = Math.max(...yValuesForX);
            borders.push([x, max + 1]);
          });

        const d =
          borders
            .map((point, i) => (i === 0 ? 'M' : 'L') + point.join(','))
            .join('') +
          'L' +
          borders[0].join(',');

        this.shapes.push({
          d,
          stroke: 'orange',
          'stroke-width': 2,
          fill: 'none',
        });
      });

      // this.highlightPixels = hotspots.reduce((a, b) => a.concat(b));
    },
  },
};
</script>

<style lang="scss">
.triangles {
  width: 100vw;
  height: 100vh;
  background-color: #2c003e;
}

svg {
  width: 100%;
  height: 100%;

  rect {
    opacity: 0.5;
  }
}
</style>
