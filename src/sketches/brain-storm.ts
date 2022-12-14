import * as THREE from 'three';
import { MeshLineGeometry, MeshLineMaterial } from 'meshline';

// https://www.shutterstock.com/image-illustration/man-silhouette-floating-over-colored-space-1871484967
import figurePoints from './brain-storm-path.json';

import toCanvasComponent, {
  Config,
  InitFn,
  FrameFn,
  InitProps,
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

function initCamera({ width, height }: InitProps<SketchConfig>) {
  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
  camera.position.z = 350;
  return camera;
}

function initLighting() {
  const lightingGroup = new THREE.Group();

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(0, 0, 10);
  lightingGroup.add(directionalLight);

  return { group: lightingGroup };
}

function initFigure({ config, width, height }: InitProps<SketchConfig>) {
  if (!config) throw new Error('????');

  const figureGroup = new THREE.Group();

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

  figureGroup.add(outlineObject);
  figureGroup.add(fillObject);

  return { group: figureGroup, outlineMaterial };
}

const init: InitFn<CanvasState, SketchConfig> = (props) => {
  props.initControls(({ pane, config }) => {
    pane.addInput(config, 'lineWidth', { min: 0, max: 5 });
  });

  const scene = new THREE.Scene();

  const camera = initCamera(props);
  scene.add(camera);

  const lighting = initLighting();
  scene.add(lighting.group);

  const figure = initFigure(props);
  scene.add(figure.group);

  return { scene, camera, outlineMaterial: figure.outlineMaterial };
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
