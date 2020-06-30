<template>
  <div>
    <canvas ref="canvas"></canvas>
  </div>
</template>

<script>
import * as THREE from 'three';

export default {
  data: () => ({
    frameId: undefined
  }),
  mounted() {
    const rect = this.$refs.canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    this.renderer = new THREE.WebGLRenderer({ canvas: this.$refs.canvas });
    this.renderer.setSize(width, height);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xefefef);

    const geometry = new THREE.BoxGeometry(2, 2, 2);
    const material = new THREE.MeshPhongMaterial({ color: 0xffffff });
    this.cube = new THREE.Mesh(geometry, material);
    this.cube.rotation.x = Math.PI / 4;
    this.cube.rotation.y = Math.PI / 4;
    this.scene.add(this.cube);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.15);
    this.directionalLight = directionalLight;
    this.lightAngle = Math.PI / 2;
    this.updateLightPosition();
    directionalLight.target = this.cube;
    this.scene.add(directionalLight);

    // const lightHelper = new THREE.DirectionalLightHelper(
    //   directionalLight,
    //   1,
    //   0xff0000
    // );
    // this.scene.add(lightHelper);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(ambientLight);

    this.camera = new THREE.PerspectiveCamera(100, width / height, 0.1, 1000);
    this.camera.position.z = 5;

    this.frameId = requestAnimationFrame(this.frame);
  },
  beforeDestroy() {
    cancelAnimationFrame(this.frameId);
  },
  methods: {
    frame() {
      this.cube.rotation.x += 0.01;
      this.cube.rotation.y += 0.01;
      this.lightAngle += 0.05;
      this.updateLightPosition();
      this.renderer.render(this.scene, this.camera);
      this.frameId = requestAnimationFrame(this.frame);
    },
    updateLightPosition() {
      const distance = 1;

      const x = distance * Math.cos(this.lightAngle);
      const y = distance * Math.sin(this.lightAngle);

      this.directionalLight.position.set(x, y, 3);
      this.directionalLight.lookAt(0, 0, 0);
    }
  }
};
</script>

<style scoped>
canvas {
  width: 100vw;
  height: 100vh;
}
</style>
