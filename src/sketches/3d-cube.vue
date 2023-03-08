<template>
  <div
    :class="this.preview ? 'w-full h-full' : 'w-screen h-screen'"
    @click="status = status === 'playing' ? 'paused' : 'playing'"
  >
    <canvas ref="canvas" class="w-full h-full"></canvas>
  </div>
</template>

<script>
import * as THREE from 'three';
import SimplexNoise from 'simplex-noise';
import BlobCanvas from '../utils/textures/blobs';

export const meta = {
  name: 'Contour texture on cube',
  date: '2020-06-15',
  tags: ['Three.js', 'Canvas 2D', 'Noise'],
  favourite: true,
};

const simplex = new SimplexNoise();

export default {
  props: {
    preview: {
      type: Boolean,
      default: false,
    },
    animatingOverride: {
      type: String,
      default: undefined,
    },
  },
  data: () => ({
    status: 'playing',
    timestamp: 0,
    frameId: undefined,
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

    const geometry = new THREE.BoxGeometry(2, 2, 2);

    const { canvasTextures, materials } = this.generateMaterials();
    this.canvasTextures = canvasTextures;
    this.materials = materials;
    this.cube = new THREE.Mesh(geometry, materials);
    this.cube.rotation.x = Math.PI / 4;
    this.cube.rotation.y = Math.PI / 4;
    this.cube.rotation.x = (Math.PI / -4) * 3;
    this.cube.rotation.y = Math.PI / 4;
    // this.cube.rotation.z = Math.PI / 4
    this.scene.add(this.cube);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    this.directionalLight = directionalLight;
    this.updateLightPosition();
    directionalLight.target = this.cube;
    this.scene.add(directionalLight);

    // const lightHelper = new THREE.DirectionalLightHelper(
    //   directionalLight,
    //   1,
    //   0xff0000
    // );
    // this.scene.add(lightHelper);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    this.camera = new THREE.PerspectiveCamera(80, width / height, 0.1, 1000);
    this.camera.position.z = 4;

    this.frameId = requestAnimationFrame(this.frame);
  },
  beforeUnmount() {
    cancelAnimationFrame(this.frameId);
  },
  methods: {
    frame(timestamp) {
      this.frameId = requestAnimationFrame(this.frame);

      if (this.status === 'paused' || this.animatingOverride === 'false') {
        return;
      }

      this.cube.rotation.x = timestamp / 6e3;
      this.cube.rotation.y = timestamp / 6e3;
      this.timestamp = timestamp;
      this.updateLightPosition();

      // @TODO only update textures that are facing camera
      this.canvasTextures.forEach(({ blobCanvas, texture }) => {
        blobCanvas.frame(timestamp);
        texture.needsUpdate = true;
      });

      this.renderer.render(this.scene, this.camera);
    },
    updateLightPosition() {
      const distance = 1;

      const lightAngle = this.timestamp / 1e3;
      const x = distance * Math.cos(lightAngle);
      const y = distance * Math.sin(lightAngle);

      this.directionalLight.position.set(x, y, 3);
      this.directionalLight.lookAt(0, 0, 0);
    },
    generateMaterials() {
      const size = 1.5;

      const canvasTextures = [
        this.generateCanvasTexture(0, size, size, size, 0, size, Math.PI / -2),
        this.generateCanvasTexture(0, 0, 0, size, size, 0, Math.PI / -2),
        this.generateCanvasTexture(0, size, size, 0, 0, 0, Math.PI / -2),
        this.generateCanvasTexture(size, 0, size, size, size, 0, Math.PI / -2),
        this.generateCanvasTexture(0, 0, size, size, 0, 0, Math.PI / -2),
        this.generateCanvasTexture(0, size, 0, size, size, size, Math.PI / -2),
      ];

      const materials = [
        new THREE.MeshPhongMaterial({ map: canvasTextures[0].texture }),
        new THREE.MeshPhongMaterial({ map: canvasTextures[1].texture }),
        new THREE.MeshPhongMaterial({ map: canvasTextures[2].texture }),
        new THREE.MeshPhongMaterial({ map: canvasTextures[3].texture }),
        new THREE.MeshPhongMaterial({ map: canvasTextures[4].texture }),
        new THREE.MeshPhongMaterial({ map: canvasTextures[5].texture }),
      ];

      return { canvasTextures, materials };
    },
    generateCanvasTexture(x1, y1, z1, x2, y2, z2, rotation = 0) {
      const xRange = x2 - x1;
      const yRange = y2 - y1;
      const zRange = z2 - z1;

      const plane = !xRange ? 'x' : !yRange ? 'y' : 'z';

      // textureX and textureY are numbers between 0 and 1
      const map = (textureX, textureY) => {
        if (plane === 'z') {
          return [x1 + xRange * textureX, y1 + yRange * textureY, z1];
        }

        if (plane === 'y') {
          return [x1 + xRange * textureX, y1, z1 + zRange * textureY];
        }

        return [x1, y1 + yRange * textureX, z1 + zRange * textureY];
      };

      // Generate texture for cube faces
      const textureWidth = 256;
      const textureHeight = 256;

      const blobCanvas = new BlobCanvas({
        customNoiseAt: (x, y) => {
          const time = this.timestamp / 10e3;
          return simplex.noise4D(
            ...map(x / textureWidth, y / textureHeight),
            time
          );
        },
        width: textureWidth,
        height: textureHeight,
        dpr: 1,
      });
      blobCanvas.frame();

      const texture = new THREE.CanvasTexture(blobCanvas.getCanvas());

      // @TODO pretty sure this is only required because i've put the faces in
      // the wrong order lol
      if (rotation) {
        texture.center = new THREE.Vector2(0.5, 0.5);
        texture.rotation = rotation;
      }

      return { blobCanvas, texture };
    },
  },
};
</script>
