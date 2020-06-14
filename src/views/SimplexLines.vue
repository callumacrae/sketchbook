<template>
  <div class="triangles">
    <svg>
      <path v-for="(point, i) in points" :key="i" :d="d(point)" />
    </svg>
  </div>
</template>

<script>
import Vue from 'vue';
import SimplexNoise from 'simplex-noise';

const simplex = new SimplexNoise();

export default Vue.extend({
  data: () => ({
    points: [],
    z: 0
  }),
  mounted() {
    const width = 40;
    const height = 20;

    if (!this.points.length) {
      for (let i = 0; i < width; i++) {
        for (let j = 0; j < height; j++) {
          this.points.push({ i, j });
        }
      }
    }

    const frame = () => {
      this.z += 1;

      requestAnimationFrame(frame);
    };

    requestAnimationFrame(frame);
  },
  methods: {
    d(point) {
      const noise = simplex.noise3D(
        point.i / 20,
        point.j / 20,
        this.z / 100
      );

      const noise2 = simplex.noise3D(
        point.i / 10,
        point.j / 10,
        this.z / 30
      ) / 5;

      const length = 15;
      const angle = Math.PI * (noise + noise2);

      const centroid = {
        x: (point.i + 2) * 20,
        y: (point.j + 2) * 20
      };
      const vector = {
        x: (length / 2) * Math.cos(angle),
        y: (length / 2) * Math.sin(angle)
      };

      return (
        `M ${centroid.x - vector.x} ${centroid.y - vector.y}` +
        `L ${centroid.x + vector.x} ${centroid.y + vector.y}`
      );
    }
  }
});
</script>

<style lang="scss">
.triangles {
  height: 100vh;
}

svg {
  width: 100%;
  height: 100%;

  path {
    stroke-width: 2;
    stroke: black;
  }
}
</style>
