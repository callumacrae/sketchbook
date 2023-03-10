import * as THREE from 'three';

import TweakpanePlugin from '@/utils/plugins/tweakpane';
import { extendMaterial } from '@/utils/three-extend-material';

import type {
  SketchConfig,
  InitFn,
  InitProps,
  FrameFn,
} from '@/utils/renderers/vanilla';

export const meta = {
  name: 'three-extend-material',
  date: '2022-12-21',
  tags: ['Three.js'],
};

const glsl = String.raw;

interface CanvasState {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  normalCube: Awaited<ReturnType<typeof initNormalCube>>;
  shaderCube: Awaited<ReturnType<typeof initShaderCube>>;
}

const userConfig = {
  speedY: 0.01,
};
type UserConfig = typeof userConfig;

const tweakpanePlugin = new TweakpanePlugin<CanvasState, UserConfig>(
  ({ pane, config }) => {
    pane.addInput(config, 'speedY', { min: -0.2, max: 0.2 });
  }
);

export const sketchConfig: Partial<SketchConfig<CanvasState, UserConfig>> = {
  type: 'threejs',
  userConfig,
  plugins: [tweakpanePlugin],
};

function initCamera(
  scene: THREE.Scene,
  { width, height }: InitProps<CanvasState, UserConfig>
) {
  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 100);
  camera.position.z = 5;
  scene.add(camera);
  return camera;
}

function initLighting(scene: THREE.Scene) {
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
  directionalLight.position.set(0, 0, 10);
  scene.add(directionalLight);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
  scene.add(ambientLight);
}

function initNormalCube(scene: THREE.Scene) {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    shininess: 60,
  });
  const cube = new THREE.Mesh(geometry, material);
  cube.translateY(-1);
  scene.add(cube);

  const frame: FrameFn<CanvasState, UserConfig> = ({
    userConfig: config,
    delta,
  }) => {
    if (!config) throw new Error('???');

    cube.rotation.y += (config.speedY / 16.6) * delta;
  };
  return { frame };
}

function initShaderCube(scene: THREE.Scene) {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const extendedMaterial = extendMaterial(THREE.MeshPhongMaterial, {
    class: THREE.ShaderMaterial,

    explicit: false,

    vertexHeader: glsl`
      uniform float yRotation;
      mat4 rotationYMatrix(float angle) {
        return mat4(
          cos(angle), 0.0, sin(angle), 0.0,
          0.0, 1.0, 0.0, 0.0,
          -sin(angle), 0.0, cos(angle), 0.0,
          0.0, 0.0, 0.0, 1.0
        );
      }`,
    vertex: {
      transformEnd: glsl`
        transformed = (vec4(transformed, 0.0) * rotationYMatrix(yRotation)).xyz;
      `,
      '#include <beginnormal_vertex>': glsl`
        objectNormal = (vec4(objectNormal, 0.0) * rotationYMatrix(yRotation)).xyz;
      `,
    },

    uniforms: {
      yRotation: {
        shared: true,
        mixed: true,
        value: 0,
      },
      shininess: {
        value: 60,
      },
    },
  });

  const cube = new THREE.Mesh(geometry, extendedMaterial);
  cube.translateY(1);
  scene.add(cube);

  const frame: FrameFn<CanvasState, UserConfig> = ({
    userConfig: config,
    delta,
  }) => {
    if (!config) throw new Error('???');

    extendedMaterial.uniforms.yRotation.value += (config.speedY / 16.6) * delta;
  };
  return { frame };
}

export const init: InitFn<CanvasState, UserConfig> = (props) => {
  const scene = new THREE.Scene();

  const camera = initCamera(scene, props);
  initLighting(scene);
  const normalCube = initNormalCube(scene);
  const shaderCube = initShaderCube(scene);

  return { scene, camera, normalCube, shaderCube };
};

export const frame: FrameFn<CanvasState, UserConfig> = (props) => {
  const { renderer, userConfig: config, state } = props;
  if (!renderer || !config) throw new Error('???');

  state.normalCube.frame(props);
  state.shaderCube.frame(props);

  renderer.render(state.scene, state.camera);
};
