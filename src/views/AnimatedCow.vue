<template>
  <canvas ref="canvas"></canvas>
</template>

<script>
import * as THREE from 'three';
import { OBJLoader2 } from 'three/examples/jsm/loaders/OBJLoader2';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

import cowUrl from '!file-loader!../assets/cow.obj';

import SimplexNoise from 'simplex-noise';

import chroma from 'chroma-js';
import { schemePRGn } from 'd3-scale-chromatic';

const colorScale = chroma.scale(schemePRGn[11]).domain([-1, 1]);

const simplex = new SimplexNoise();

export default {
  data: () => ({
    frameId: undefined,
    z: 0
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
    this.directionalLight.position.set(400, 400, 400)
    this.directionalLight.lookAt(0, 0, 0)
    this.scene.add(this.directionalLight)

    this.camera = new THREE.PerspectiveCamera(100, width / height, 500, 5000);
    this.camera.position.x = 257 * 2;
    this.camera.position.y = 457 * 2;
    this.camera.position.z = 1000;

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);

    const texture = this.generateTexture();
    this.material = new THREE.MeshPhongMaterial({
      map: texture
    });

    const objLoader = new OBJLoader2();
    objLoader.load(cowUrl, root => {
      root.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.material = this.material;
        }
      });
      this.scene.add(root);

      const box = new THREE.Box3().setFromObject(root);
      const boxSize = box.getSize(new THREE.Vector3()).length();
      const boxCenter = box.getCenter(new THREE.Vector3());
      this.camera.lookAt(boxCenter.x, boxCenter.y, boxCenter.z);
      console.log(boxSize, boxCenter);
      this.frame();
    });
  },
  beforeDestroy() {
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
      const data = new Uint8Array(3 * size);
      const z = this.z;

      for (let i = 0; i < size; i++) {
        const stride = i * 3;

        const x = i % textureWidth;
        const y = Math.floor(i / textureHeight);
        const noise = simplex.noise3D(x / 20, y / 20, z / 5);

        const color = noise > 0.33 ? 80 : 255;
        data[stride] = color;
        data[stride + 1] = color;
        data[stride + 2] = color;
      }

      return new THREE.DataTexture(
        data,
        textureWidth,
        textureHeight,
        THREE.RGBFormat
      );
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
