<template>
  <div class="main">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 508 317.5"
      height="1200"
      width="1920"
    >
      <ellipse
        ry="40.901"
        rx="28.443"
        cy="4.231"
        cx="168.633"
        :fill="leftColor"
        :opacity="leftCircleOpacity"
      />
      <ellipse
        cx="289.72"
        cy="133.038"
        rx="26.285"
        ry="31.762"
        :fill="rightColor"
        :opacity="rightCircleOpacity"
      />
      <ellipse
        ry="32.821"
        rx="28.189"
        cy="164.259"
        cx="231.592"
        :fill="middleColor"
        :opacity="middleCircleOpacity"
      />
      <path
        d="M176.477 43.392c48.948 76.2-10.583 176.477 21.96 272.52"
        fill="none"
        :stroke="leftColor"
        stroke-width="2.5"
        stroke-dasharray="10% 90%"
        :stroke-dashoffset="leftDashOffset"
      />
      <path
        d="M224.631 196.32c-12.435 42.07-10.848 80.963-3.175 118.534"
        fill="none"
        :stroke="middleColor"
        stroke-width="2.5"
        stroke-dasharray="10% 90%"
        :stroke-dashoffset="middleDashOffset"
      />
      <path
        d="M279.135 163.248c-11.906 30.162-39.423 105.304-53.71 147.902"
        fill="none"
        :stroke="rightColor"
        stroke-width="2.5"
        stroke-dasharray="10% 90%"
        :stroke-dashoffset="rightDashOffset"
      />
    </svg>
  </div>
</template>

<script>
export const meta = {
  name: 'Light tracing',
  date: '2020-06-30',
  tags: ['SVG', 'Projection mapping'],
  twitter: 'https://twitter.com/callumacrae/status/1272626085365264387',
};

export default {
  data: () => ({
    i: 0,
  }),
  mounted() {
    this.frameId = requestAnimationFrame(this.frame);
  },
  beforeUnmount() {
    cancelAnimationFrame(this.frameId);
  },
  methods: {
    frame() {
      this.i++;
      this.frameId = requestAnimationFrame(this.frame);
    },
  },
  computed: {
    leftAnimationProgress() {
      return (this.i / 500) % 1;
    },
    middleAnimationProgress() {
      return ((this.i + 126) / 650) % 1;
    },
    rightAnimationProgress() {
      return (this.i / 800) % 1;
    },
    leftColor() {
      return `hsl(${this.i / 5}, 100%, 50%)`;
    },
    middleColor() {
      return `hsl(${this.i / 4 + 120}, 100%, 50%)`;
    },
    rightColor() {
      return `hsl(${this.i / 6 + 240}, 100%, 50%)`;
    },
    leftDashOffset() {
      const to = 0.7;
      const progress = this.leftAnimationProgress;
      if (progress > to) {
        return '10%';
      }

      const min = 35;
      const max = 109;
      const offset = min + (max - min) * (progress / to);
      return `${offset}%`;
    },
    leftCircleOpacity() {
      const from = 0.5;
      const to = 1;
      const progress = this.leftAnimationProgress;
      if (progress < from) {
        return 0;
      }

      const offset = (to - from) / 2;
      const midpoint = (to + from) / 2;
      let a = ((progress - midpoint) / offset + 0.5) * 2; // 0 to 2

      if (a > 1) {
        a = 2 - a;
      }

      return a;
    },
    middleDashOffset() {
      const to = 0.7;
      const progress = this.middleAnimationProgress;
      if (progress > to) {
        return '10%';
      }

      const min = 35;
      const max = 109;
      const offset = min + (max - min) * (progress / to);
      return `${offset}%`;
    },
    middleCircleOpacity() {
      const from = 0.5;
      const to = 1;
      const progress = this.middleAnimationProgress;
      if (progress < from) {
        return 0;
      }

      const offset = (to - from) / 2;
      const midpoint = (to + from) / 2;
      let a = ((progress - midpoint) / offset + 0.5) * 2; // 0 to 2

      if (a > 1) {
        a = 2 - a;
      }

      return a;
    },
    rightDashOffset() {
      const to = 0.7;
      const progress = this.rightAnimationProgress;
      if (progress > to) {
        return '10%';
      }

      const min = 35;
      const max = 109;
      const offset = min + (max - min) * (progress / to);
      return `${offset}%`;
    },
    rightCircleOpacity() {
      const from = 0.5;
      const to = 1;
      const progress = this.rightAnimationProgress;
      if (progress < from) {
        return 0;
      }

      const offset = (to - from) / 2;
      const midpoint = (to + from) / 2;
      let a = ((progress - midpoint) / offset + 0.5) * 2; // 0 to 2

      if (a > 1) {
        a = 2 - a;
      }

      return a;
    },
  },
};
</script>

<style scoped>
.main {
  width: 1920px;
  height: 1200px;
  background-color: black;
}
</style>
