import * as THREE from 'three';

import toCanvasComponent, {
  Config,
  InitFn,
  FrameFn,
} from '../utils/to-canvas-component';

interface CanvasState {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  cube: THREE.Mesh;
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

const init: InitFn<CanvasState, SketchConfig> = ({
  initControls,
  width,
  height,
}) => {
  initControls(({ pane, config }) => {
    pane.addInput(config, 'speedX', { min: -0.2, max: 0.2 });
    pane.addInput(config, 'speedY', { min: -0.2, max: 0.2 });
  });

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 10);
  camera.position.z = 5;

  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshPhongMaterial({
    color: 0x00ff00,
    shininess: 30,
  });
  const cube = new THREE.Mesh(geometry, material);
  scene.add(cube);

  const color = 0xffffff;
  const intensity = 1;
  const light = new THREE.DirectionalLight(color, intensity);
  light.position.set(0, 0, 10);
  scene.add(light);

  return { scene, camera, cube };
};

const frame: FrameFn<CanvasState, SketchConfig> = ({
  renderer,
  config,
  state,
}) => {
  if (!renderer || !config) throw new Error('???');

  const { scene, camera, cube } = state;

  cube.rotation.x += config.speedX;
  cube.rotation.y += config.speedY;

  renderer.render(scene, camera);
};

export default toCanvasComponent<CanvasState, SketchConfig>(
  init,
  frame,
  sketchbookConfig
);
