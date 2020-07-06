<template>
  <div>
    <canvas ref="canvas"></canvas>
  </div>
</template>

<script>
import * as THREE from 'three';
import SimplexNoise from 'simplex-noise';

const simplex = new SimplexNoise();

export default {
  data: () => ({
    timestamp: 0,
    frameId: undefined
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
    const materials = this.generateMaterials();
    this.cube = new THREE.Mesh(geometry, materials);
    this.cube.rotation.x = Math.PI / 4;
    this.cube.rotation.y = Math.PI / 4;
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

    this.camera = new THREE.PerspectiveCamera(100, width / height, 0.1, 1000);
    this.camera.position.z = 5;

    this.frameId = requestAnimationFrame(this.frame);
  },
  beforeDestroy() {
    cancelAnimationFrame(this.frameId);
  },
  methods: {
    frame(timestamp) {
      // this.cube.rotation.x += 0.01;
      // this.cube.rotation.y += 0.01;
      this.timestamp = timestamp;
      this.updateLightPosition();

      const newMaterial = this.generateMaterials();
      this.cube.material = newMaterial;
      this.cube.needsUpdate = true;

      this.renderer.render(this.scene, this.camera);
      this.frameId = requestAnimationFrame(this.frame);
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
      const size = 1;
      return [
        new THREE.MeshPhongMaterial({ color: new THREE.Color('white') }),
        new THREE.MeshPhongMaterial({
          map: this.generateTexture(0, size, 0, size, 0, 0, Math.PI / -2)
        }),
        new THREE.MeshPhongMaterial({
          map: this.generateTexture(0, size, 0, 0, 0, size, Math.PI / -2)
        }),
        new THREE.MeshPhongMaterial({ color: new THREE.Color('white') }),
        new THREE.MeshPhongMaterial({
          map: this.generateTexture(0, 0, 0, size, 0, size, Math.PI / -2)
        }),
        new THREE.MeshPhongMaterial({ color: new THREE.Color('white') })
      ];
    },
    generateTexture(x1, y1, z1, x2, y2, z2, rotation = 0) {
      const xRange = x2 - x1;
      const yRange = y2 - y1;
      const zRange = z2 - z1;
      const time = this.timestamp / 10000;

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
      const textureWidth = 100;
      const textureHeight = 100;
      const size = textureWidth * textureHeight;
      const data = new Uint8Array(3 * size);

      for (let i = 0; i < size; i++) {
        const stride = i * 3;

        const x = (i / textureWidth) % 1;
        const y = Math.floor(i / textureHeight) / textureHeight;

        if (false) {
          const val = map(x, y);
          data[stride] = val[0] * 256;
          data[stride + 1] = val[1] * 256;
          data[stride + 2] = val[2] * 256;
          continue;
        }

        const noise = simplex.noise4D(...map(x, y), time);

        const color =
          noise < -0.33
            ? [255, 0, 0]
            : noise < 0.33
            ? [0, 255, 0]
            : [0, 0, 255];
        data[stride] = color[0];
        data[stride + 1] = color[1];
        data[stride + 2] = color[2];
      }

      const texture = new THREE.DataTexture(
        data,
        textureWidth,
        textureHeight,
        THREE.RGBFormat
      );

      // @TODO pretty sure this is only required because i've put the faces in
      // the wrong order lol
      if (rotation) {
        texture.center = new THREE.Vector2(0.5, 0.5);
        texture.rotation = rotation;
      }

      return texture;
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
