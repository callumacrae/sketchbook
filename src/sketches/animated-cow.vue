<template>
  <canvas ref="canvas"></canvas>
</template>

<script>
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

import SimplexNoise from 'simplex-noise';

export const meta = {
  name: 'Shitty animated cow',
  date: '2020-06-04',
  tags: ['Three.js'],
};

const simplex = new SimplexNoise();

export default {
  data: () => ({
    frameId: undefined,
    z: 0,
  }),
  mounted() {
    const rect = this.$refs.canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    this.renderer = new THREE.WebGLRenderer({ canvas: this.$refs.canvas });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xefefef);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    this.directionalLight.position.set(400, 400, 400);
    this.directionalLight.lookAt(0, 0, 0);
    this.scene.add(this.directionalLight);

    this.camera = new THREE.PerspectiveCamera(100, width / height, 500, 5000);
    this.camera.position.x = 257 * 2;
    this.camera.position.y = 457 * 2;
    this.camera.position.z = 1000;

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);

    const texture = this.generateTexture();
    this.material = new THREE.MeshPhongMaterial({
      map: texture,
    });

    const objLoader = new OBJLoader();
    objLoader.load('/animated-cow/cow.obj', (root) => {
      root.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material = this.material;
        }
      });
      this.scene.add(root);

      const box = new THREE.Box3().setFromObject(root);
      const boxCenter = box.getCenter(new THREE.Vector3());
      this.camera.lookAt(boxCenter.x, boxCenter.y, boxCenter.z);
      this.frame();
    });
  },
  beforeUnmount() {
    cancelAnimationFrame(this.frameId);
  },
  methods: {
    frame() {
      this.z += 0.01;
      const newTexture = this.generateTexture();
      this.material.map = newTexture;
      this.material.needsUpdate = true;

      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      this.frameId = requestAnimationFrame(this.frame);
    },
    generateTexture() {
      // Generate texture for cube faces
      const textureWidth = 100;
      const textureHeight = 100;
      const size = textureWidth * textureHeight;
      const data = new Uint8Array(4 * size);
      const z = this.z;

      for (let i = 0; i < size; i++) {
        const stride = i * 4;

        const x = i % textureWidth;
        const y = Math.floor(i / textureHeight);
        const noise = simplex.noise3D(x / 20, y / 20, z / 5);

        const color = noise > 0.33 ? 80 : 255;
        data[stride] = color;
        data[stride + 1] = color;
        data[stride + 2] = color;
        data[stride + 3] = 255;
      }

      const texture = new THREE.DataTexture(data, textureWidth, textureHeight);
      texture.needsUpdate = true;
      return texture;
    },
  },
};
</script>

<style scoped>
canvas {
  width: 100vw;
  height: 100vh;
}
</style>
