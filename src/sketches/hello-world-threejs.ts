import * as THREE from 'three';

import { toCanvasComponent } from '@/utils/renderers/vue';
import type {
  Config,
  InitFn,
  InitProps,
  FrameFn,
} from '@/utils/renderers/vanilla';

interface CanvasState {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  cube: Awaited<ReturnType<typeof initCube>>;
}

const sketchConfig = {
  speedX: 0.01,
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
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(0, 0, 10);
  scene.add(directionalLight);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
}

function initCube(scene: THREE.Scene) {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshPhongMaterial({
    color: 0x00ff00,
    shininess: 30,
  });
  const cube = new THREE.Mesh(geometry, material);
  scene.add(cube);

  const frame: FrameFn<CanvasState, SketchConfig> = ({ config, delta }) => {
    if (!config) throw new Error('???');

    cube.rotation.x += (config.speedX / 16.6) * delta;
    cube.rotation.y += (config.speedY / 16.6) * delta;
  };
  return { frame };
}

const init: InitFn<CanvasState, SketchConfig> = (props) => {
  props.initControls(({ pane, config }) => {
    pane.addInput(config, 'speedX', { min: -0.2, max: 0.2 });
    pane.addInput(config, 'speedY', { min: -0.2, max: 0.2 });
  });

  const scene = new THREE.Scene();

  const camera = initCamera(scene, props);
  initLighting(scene);
  const cube = initCube(scene);

  return { scene, camera, cube };
};

const frame: FrameFn<CanvasState, SketchConfig> = (props) => {
  const { renderer, config, state } = props;
  if (!renderer || !config) throw new Error('???');

  state.cube.frame(props);

  renderer.render(state.scene, state.camera);
};

export default toCanvasComponent<CanvasState, SketchConfig>(
  init,
  frame,
  sketchbookConfig
);
