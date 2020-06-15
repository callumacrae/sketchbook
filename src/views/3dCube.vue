<template>
  <div></div>
</template>

<script>
import * as THREE from 'three';

export default {
  data: () => ({
    frameId: undefined
  }),
  mounted() {
    this.scene = new THREE.Scene();
    // const rect = this.$el.getBoundingClientRect();
    // const width = rect.width;
    // const height = rect.height;
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);

    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize(width, height);
    this.$el.appendChild(this.renderer.domElement);

    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    this.cube = new THREE.Mesh(geometry, material);
    this.scene.add(this.cube);

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
      this.renderer.render(this.scene, this.camera);
      this.frameId = requestAnimationFrame(this.frame);
    }
  }
};
</script>
