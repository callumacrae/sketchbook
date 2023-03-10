import * as THREE from 'three';

import TweakpanePlugin from '@/utils/plugins/tweakpane';
import type {
  SketchConfig,
  InitFn,
  InitProps,
  FrameFn,
} from '@/utils/renderers/vanilla';

export const meta = {
  name: 'Hello world (threejs)',
  date: '2022-12-13',
  tags: ['Three.js', 'Hello World'],
};

export interface CanvasState {
  scene: THREE.Scene;
  camera: ReturnType<typeof initCamera>;
}

const userConfig = {};
export type UserConfig = typeof userConfig;

const tweakpanePlugin = new TweakpanePlugin<CanvasState, UserConfig>();

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

  return { camera };
}

function initLighting(scene: THREE.Scene) {
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(0, 0, 10);
  scene.add(directionalLight);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
}

export const init: InitFn<CanvasState, UserConfig> = (props) => {
  const scene = new THREE.Scene();

  const camera = initCamera(scene, props);
  initLighting(scene);

  return { scene, camera };
};

export const frame: FrameFn<CanvasState, UserConfig> = (props) => {
  const { renderer, userConfig: config, state } = props;
  if (!renderer || !config) throw new Error('???');

  renderer.render(state.scene, state.camera.camera);
};
