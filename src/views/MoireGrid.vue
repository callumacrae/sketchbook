<template>
  <div>
    <canvas
      ref="canvas"
      @click="status = status === 'playing' ? 'paused' : 'playing'"
    ></canvas>

    <div class="options">
      <h2>Motion:</h2>

      <table>
        <tr>
          <td>
            <label for="rotation" @click="options.rotation = 0">
              Rotation:
            </label>
          </td>
          <td>
            <input
              id="rotation"
              type="range"
              v-model.number="options.rotation"
              min="-0.02"
              max="0.02"
              step="0.001"
            />
          </td>
        </tr>
        <tr>
          <td>
            <label for="xValue" @click="options.x = 0">
              x:
            </label>
          </td>
          <td>
            <input
              id="xValue"
              type="range"
              v-model.number="options.x"
              min="0"
              max="0.05"
              step="0.001"
            />
          </td>
        </tr>
        <tr>
          <td>
            <label for="yValue" @click="options.y = 0">
              y:
            </label>
          </td>
          <td>
            <input
              id="yValue"
              type="range"
              v-model.number="options.y"
              min="0"
              max="0.05"
              step="0.001"
            />
          </td>
        </tr>
        <tr>
          <td>
            <label for="type">Type:</label>
          </td>
          <td>
            <select v-model="options.grid">
              <option value="lines">Lines</option>
              <option value="grid">Grid</option>
              <option value="circles">Circles</option>
              <option value="hexagons">Hexagons</option>
              <option value="triangles">Triangles</option>
            </select>
          </td>
        </tr>
        <tr>
          <td>
            <label for="lineWidth" @click="options.lineWidth = 8">
              Line width:
            </label>
          </td>
          <td>
            <input
              id="lineWidth"
              type="range"
              v-model.number="options.lineWidth"
              min="0.5"
              max="20"
              step="0.5"
            />
          </td>
        </tr>
        <tr v-if="options.grid === 'hexagons'">
          <td>
            <label for="hexagonRadius" @click="options.hexagonRadius = 10">
              Hexagon radius:
            </label>
          </td>
          <td>
            <input
              id="hexagonRadius"
              type="range"
              v-model.number="options.hexagonRadius"
              min="2"
              max="40"
              step="0.25"
            />
          </td>
        </tr>
        <tr v-if="options.grid === 'circles'">
          <td>
            <label for="circleRadius" @click="options.circleRadius = 8">
              Circle radius:
            </label>
          </td>
          <td>
            <input
              id="circleRadius"
              type="range"
              v-model.number="options.circleRadius"
              min="0.5"
              max="10"
              step="0.25"
            />
          </td>
        </tr>
        <tr>
          <td>
            <label for="blended" @click="options.blend = false">
              Blended:
            </label>
          </td>
          <td>
            <input
              id="blended"
              type="checkbox"
              v-model.number="options.blend"
            />
          </td>
        </tr>
        <tr>
          <td>
            <label for="fill" @click="options.fill = false">
              Fill:
            </label>
          </td>
          <td>
            <input id="fill" type="checkbox" v-model.number="options.fill" />
          </td>
        </tr>
      </table>

      <small>Click label to reset value.</small>
    </div>

    <GlobalEvents target="window" @resize="init" />
  </div>
</template>

<script>
import recordMixin from '../mixins/record';
import { doWorkOffscreen } from '../utils/canvas';

export default {
  mixins: [recordMixin],
  data: () => ({
    status: 'playing',
    width: undefined,
    height: undefined,
    options: {
      rotation: 0.0075,
      x: 0,
      y: 0,
      grid: 'hexagons',
      lineWidth: 3,
      circleRadius: 8,
      hexagonRadius: 10,
      blend: false,
      fill: true
    },
    gridTransform: {
      rotation: 0.2,
      x: 0,
      y: 0
    }
  }),
  mounted() {
    this.setSize();
    this.init();
    this.frame();

    {
      const isHole = ([x, y]) => {
        const pixel = this.ctx.getImageData(x, y, 1, 1).data;
        return pixel[3] < 100;
      };

      console.time('getImageData per pixel');

      for (let i = 0; i < 1000; i++) {
        isHole([100, 100]);
      }

      console.timeEnd('getImageData per pixel');
    }

    {
      const { width, height } = this;
      const imageData = this.ctx.getImageData(0, 0, width, height).data;

      const isHole = ([x, y]) => {
        const pixel = imageData[4 * (y * width + x) + 3];
        return pixel < 100;
      };

      console.time('getImageData once');

      for (let i = 0; i < 1000; i++) {
        isHole([100, 100]);
      }

      console.timeEnd('getImageData once');
    }
  },
  beforeDestroy() {
    cancelAnimationFrame(this.frameId);
  },
  methods: {
    setSize() {
      const canvas = this.$refs.canvas;
      this.ctx = canvas.getContext('2d');

      const dpr = window.devicePixelRatio;
      this.width = canvas.clientWidth * dpr;
      this.height = canvas.clientHeight * dpr;
      canvas.width = this.width;
      canvas.height = this.height;
    },
    setupGrid() {
      if (this.options.blend) {
        this.gridBitmapOne = this.generateGrid('red');
        this.gridBitmapTwo = this.generateGrid('blue');
      } else {
        this.gridBitmapOne = this.gridBitmapTwo = this.generateGrid();
      }
    },
    generateGrid(color = 'black') {
      const { width, height } = this;

      const gridWidth = Math.max(width, height);

      return doWorkOffscreen(gridWidth, gridWidth, ctx => {
        ctx.lineWidth = this.options.lineWidth;
        ctx.strokeStyle = color;

        if (['lines', 'grid'].includes(this.options.grid)) {
          for (let x = 0; x < width; x += 20) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
          }
        }

        if (this.options.grid === 'grid') {
          for (let y = 0; y < height; y += 20) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
          }
        }

        if (this.options.grid === 'circles') {
          for (let x = 0; x < width; x += 20) {
            for (let y = 0; y < height; y += 20) {
              ctx.beginPath();
              ctx.arc(x, y, this.options.circleRadius, 0, Math.PI * 2);
              ctx.stroke();
            }
          }
        }

        if (this.options.grid === 'hexagons') {
          const radius = this.options.hexagonRadius;
          const xOfAngledSegment = Math.tan(Math.PI / 6) * radius;

          for (let y = radius; y < height; y += radius) {
            const isOdd = y % (radius * 2) === radius;

            ctx.beginPath();
            const oddY = isOdd ? y - radius : y;
            const evenY = isOdd ? y : y - radius;

            for (let i = 0; i < 5000; i++) {
              const flatSegments = Math.floor(i / 2);
              const angledSegments = Math.ceil(i / 2);

              const x =
                flatSegments * radius + angledSegments * xOfAngledSegment;
              const y = (i + 3) % 4 < 2 ? oddY : evenY;

              if (x > width) {
                break;
              }

              if (i === 0) {
                ctx.moveTo(x, y);
              } else {
                ctx.lineTo(x, y);
              }
            }

            ctx.stroke();
          }
        }

        if (this.options.grid === 'triangles') {
          const triangleHeight = 20;
          const xOfAngledSegment = Math.tan(Math.PI / 6) * triangleHeight;

          for (let y = triangleHeight; y < height; y += triangleHeight) {
            const isOdd = y % (triangleHeight * 2) === triangleHeight;

            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);

            const oddY = isOdd ? y - triangleHeight : y;
            const evenY = isOdd ? y : y - triangleHeight;

            for (let i = 0; i < 5000; i++) {
              const x = i * xOfAngledSegment;
              const y = i % 2 ? oddY : evenY;

              if (x > width) {
                break;
              }

              if (i === 0) {
                ctx.moveTo(x, y);
              } else {
                ctx.lineTo(x, y);
              }
            }

            ctx.stroke();
          }
        }
      });
    },
    init() {
      this.setupGrid();
    },
    frame(timestamp = 0) {
      this.frameId = requestAnimationFrame(this.frame);

      if (this.status !== 'playing') {
        return;
      }

      const t = timestamp / 1e3;
      const { ctx, width, height, gridBitmapOne, gridBitmapTwo } = this;

      ctx.globalCompositeOperation = 'multiply';

      ctx.clearRect(0, 0, width, height);

      const gridWidth = Math.max(width, height);
      ctx.drawImage(gridBitmapOne, 0, 0, gridWidth, gridWidth);

      ctx.save();

      this.gridTransform.rotation += this.options.rotation;
      this.gridTransform.x += this.options.x;
      this.gridTransform.y += this.options.y;

      const transformX = Math.sin(this.gridTransform.x) * 100;
      const transformY = Math.sin(this.gridTransform.y) * 100;
      ctx.translate(transformX, transformY);

      ctx.translate(width / 2, height / 2);
      ctx.rotate(this.gridTransform.rotation);
      ctx.translate(width / -2, height / -2);

      ctx.drawImage(gridBitmapTwo, 0, 0, gridWidth, gridWidth);

      ctx.restore();

      if (this.options.fill) {
        // only search one atm:

        const includes = (ary, [x1, y1]) => {
          return ary.some(([x2, y2]) => (x1 === x2) & (y1 === y2));
        };

        const addIfNotAlready = (ary, coords) => {
          if (!includes(ary, coords)) {
            ary.push(coords);
          }
        };

        const imageData = ctx.getImageData(0, 0, width, height).data;
        const isHole = ([x, y]) => {
          const pixel = imageData[4 * (y * width + x) + 3];
          return pixel < 100;
        };

        const search = [[105, 110]];
        const hole = [];

        let bailAt = 1000;

        for (let i = 0; i < search.length; i++) {
          if (bailAt-- < 1) {
            throw new Error('INFINITE LOOP');
          }

          if (isHole(search[i])) {
            hole.push(search[i]);

            const [x, y] = search[i];

            addIfNotAlready(search, [x - 1, y]);
            addIfNotAlready(search, [x + 1, y]);
            addIfNotAlready(search, [x, y - 1]);
            addIfNotAlready(search, [x, y + 1]);
          }
        }

        ctx.fillStyle = 'red';
        for (const [x, y] of hole) {
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
  },
  watch: {
    'options.grid': 'setupGrid',
    'options.lineWidth': 'setupGrid',
    'options.lineWidth': 'setupGrid',
    'options.circleRadius': 'setupGrid',
    'options.hexagonRadius': 'setupGrid',
    'options.blend': 'setupGrid',
    'options.fill': 'setupGrid'
  }
};
</script>

<style scoped>
canvas {
  width: 100vw;
  height: 100vh;
}

.options {
  position: fixed;
  bottom: 15px;
  right: 15px;
  padding: 10px 15px;
  background: rgba(255, 255, 255, 0.85);
  border-radius: 3px;
}

.options h2 {
  text-align: center;
  font-size: 1em;
  margin-top: 0;
}

.options input:not([type='checkbox']),
.options select {
  vertical-align: middle;
  width: 100%;
}

.options small {
  display: block;
  margin-top: 4px;
  text-align: center;
}
</style>
