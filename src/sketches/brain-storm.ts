import * as THREE from 'three';
import { MeshLineGeometry, MeshLineMaterial } from 'meshline';

import figurePoints from './brain-storm-path.json';

import toCanvasComponent, {
  Config,
  InitFn,
  FrameFn,
} from '../utils/to-canvas-component';

interface CanvasState {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  outlineMaterial: MeshLineMaterial;
}

const sketchConfig = {
  lineWidth: 1.2,
};
type SketchConfig = typeof sketchConfig;

const sketchbookConfig: Partial<Config<SketchConfig>> = {
  type: 'threejs',
  sketchConfig,
};

const init: InitFn<CanvasState, SketchConfig> = ({
  initControls,
  config,
  width,
  height,
}) => {
  if (!config) throw new Error('????');

  initControls(({ pane, config }) => {
    pane.addInput(config, 'lineWidth', { min: 0, max: 5 });
  });

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
  camera.position.z = 350;

  const color = 0xffffff;
  const intensity = 1;
  const light = new THREE.DirectionalLight(color, intensity);
  light.position.set(0, 0, 10);
  scene.add(light);

  const outlineGeom = new MeshLineGeometry();
  outlineGeom.setPoints(figurePoints as [number, number][]);
  const fillShape = new THREE.Shape();
  for (let i = 0; i < figurePoints.length; i++) {
    const point = figurePoints[i];
    if (i === 0) {
      fillShape.moveTo(point[0], point[1]);
    } else {
      fillShape.lineTo(point[0], point[1]);
    }
  }
  const fillGeom = new THREE.ShapeGeometry(fillShape);
  // The translate ensures that it appears behind the outline
  fillGeom.translate(0, 0, -0.1);

  const outlineMaterial = new MeshLineMaterial({
    color: 0xffffff,
    lineWidth: config.lineWidth,
    resolution: new THREE.Vector2(width, height),
  });

  const fillMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });

  const outlineObject = new THREE.Mesh(outlineGeom, outlineMaterial);
  const fillObject = new THREE.Mesh(fillGeom, fillMaterial);

  scene.add(outlineObject);
  scene.add(fillObject);

  return { scene, camera, outlineMaterial };
};

const frame: FrameFn<CanvasState, SketchConfig> = ({
  renderer,
  config,
  state,
}) => {
  if (!renderer || !config) throw new Error('???');

  const { scene, camera, outlineMaterial } = state;

  outlineMaterial.lineWidth = config.lineWidth;

  renderer.render(scene, camera);
};

export default toCanvasComponent<CanvasState, SketchConfig>(
  init,
  frame,
  sketchbookConfig
);
