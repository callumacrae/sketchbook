import * as THREE from 'three';

import type {
  Config,
  InitFn,
  InitProps,
  FrameFn,
} from '@/utils/renderers/vanilla';

export const meta = {
  name: 'Hello world (threejs)',
  date: '2022-12-13',
};

export interface CanvasState {
  scene: THREE.Scene;
  camera: ReturnType<typeof initCamera>;
}

const sketchConfig = {};
export type SketchConfig = typeof sketchConfig;

export const sketchbookConfig: Partial<Config<CanvasState, SketchConfig>> = {
  type: 'threejs',
  sketchConfig,
};

function initCamera(
  scene: THREE.Scene,
  { width, height }: InitProps<CanvasState, SketchConfig>
) {
  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 100);
  camera.position.z = 5;
  scene.add(camera);

  return { camera };
}

function initLighting(scene: THREE.Scene) {
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(0, 0, 10);
  scene.add(directionalLight);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
}

export const init: InitFn<CanvasState, SketchConfig> = (props) => {
  // props.initControls(({ pane, config }) => {
  // });

  const scene = new THREE.Scene();

  const camera = initCamera(scene, props);
  initLighting(scene);

  return { scene, camera };
};

export const frame: FrameFn<CanvasState, SketchConfig> = (props) => {
  const { renderer, config, state } = props;
  if (!renderer || !config) throw new Error('???');

  renderer.render(state.scene, state.camera.camera);
};
