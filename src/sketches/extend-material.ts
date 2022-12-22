import * as THREE from 'three';
import { extendMaterial } from '@/utils/three-extend-material';

import { toCanvasComponent } from '@/utils/renderers/vue';
import type {
  Config,
  InitFn,
  InitProps,
  FrameFn,
} from '@/utils/renderers/vanilla';

const glsl = String.raw;

interface CanvasState {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  normalCube: Awaited<ReturnType<typeof initNormalCube>>;
  shaderCube: Awaited<ReturnType<typeof initShaderCube>>;
}

const sketchConfig = {
  speedY: 0.01,
};
type SketchConfig = typeof sketchConfig;

const sketchbookConfig: Partial<Config<SketchConfig>> = {
  type: 'threejs',
  sketchConfig,
};

function initCamera(
  scene: THREE.Scene,
  { width, height }: InitProps<SketchConfig>
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

  const frame: FrameFn<CanvasState, SketchConfig> = ({ config, delta }) => {
    if (!config) throw new Error('???');

    cube.rotation.y += (config.speedY / 16.6) * delta;
  };
  return { frame };
}

function initShaderCube(scene: THREE.Scene) {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const extendedMaterial = extendMaterial(THREE.MeshPhongMaterial, {
    class: THREE.ShaderMaterial,

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
      }
    },
  });

  const cube = new THREE.Mesh(geometry, extendedMaterial);
  cube.translateY(1);
  scene.add(cube);

  console.log(extendedMaterial.vertexShader);

  const frame: FrameFn<CanvasState, SketchConfig> = ({ config, delta }) => {
    if (!config) throw new Error('???');

    extendedMaterial.uniforms.yRotation.value += (config.speedY / 16.6) * delta;
  };
  return { frame };
}

const init: InitFn<CanvasState, SketchConfig> = (props) => {
  props.initControls(({ pane, config }) => {
    pane.addInput(config, 'speedY', { min: -0.2, max: 0.2 });
  });

  const scene = new THREE.Scene();

  const camera = initCamera(scene, props);
  initLighting(scene);
  const normalCube = initNormalCube(scene);
  const shaderCube = initShaderCube(scene);

  return { scene, camera, normalCube, shaderCube };
};

const frame: FrameFn<CanvasState, SketchConfig> = (props) => {
  const { renderer, config, state } = props;
  if (!renderer || !config) throw new Error('???');

  state.normalCube.frame(props);
  state.shaderCube.frame(props);

  renderer.render(state.scene, state.camera);
};

export default toCanvasComponent<CanvasState, SketchConfig>(
  init,
  frame,
  sketchbookConfig
);
