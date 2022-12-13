import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader';

import toCanvasComponent, {
  Config,
  InitFn,
  FrameFn,
} from '../utils/to-canvas-component';

interface CanvasState {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
}

const sketchConfig = {};
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
  initControls(({ pane, config }) => {});

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
  camera.position.z = 700;

  const color = 0xffffff;
  const intensity = 1;
  const light = new THREE.DirectionalLight(color, intensity);
  light.position.set(0, 0, 10);
  scene.add(light);

  const loader = new SVGLoader();
  // https://www.shutterstock.com/image-illustration/man-silhouette-floating-over-colored-space-1871484967
  const data =
    loader.parse(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-97.5 -186.5 203.5 373">
  <path d="M-29.3-71.7c-.8-5-5.5-17.5-7-25-3.2 10.3-11.2 22-13.7 26.7-2.5 4.8-8.3 17-10.5 21-2.3 4-8 14.2-9.8 20.5-1 5.8-2.5 8.5-3.8 11.3a40 40 0 0 1-6.7 10.7c-2.1.5-1.8-3.5-1.3-4.7-2.8 7-8 11.2-5.7 1.2-5.8 12-8.4 8.3-5.8 1.8-1 2.5-5.6 2-3.2-2.3 1.2-2.2 6.2-12.7 8.2-18.5-5 1.8-11.5-2-1.5-4.2 5.1-1.1 6.1-1.5 6.1-1.5 5.6-9.4 7.7-21.4 11.5-31.3 5.2-13.6 13.9-24.3 18.7-38.5 5.7-17 10.7-22.2 21.2-23.5 7.1-1 18.1-3.5 18.6-11 .5-7.4.8-10.3-2-16-.6 1.8-3.3 1.3-3.8-1.2s-1.5-8 2-8.3c0-2.2-1-7.2 2.2-14.2 5-9.3 15.5-9.3 21-5.3 7.3 5.8 6.8 15 6.8 19.8.7 0 2-.3 2.2 2 .3 2.2 0 6.2-1.5 7.5-1.5 1.2-2.7-.3-2.7-.3-2.4 5.3-2 10.3-1 16 1.6 8.5 5.3 10.5 15.6 11 10.2.6 16.7 3.3 22.9 12.5 6.1 9.3 15 27.3 16.3 29.3 1.3 2 7.7 10.7 10 16C76.1-65 84.6-47 88.3-41.7c4.8 2.7 6.1 3.4 9.5 5 4.3 2 6.1 7.2 0 4.5 2.8 3.7 5.4 7.5 7.3 10.7 1.5 2.8 1.5 10.3-4.3 1.8 2.8 5.7-1 6.2-3.5 2.7-1.5 4-5.7-1.3-6.5-2.2.8 2.2-.4 3.8-2.5 2.5a42 42 0 0 1-10.2-15c-1.8-4.3-5.5-9.3-7.3-11.8-1.7-2.5-11.5-14.2-14-17.7s-6-10.7-9.2-16c-2-3.3-12.8-16.3-13.3-21-.5 5-2.1 10.7-3 16C30.6-77 29-69.5 29.2-63c.2 6 1.3 15.3 3 23a277 277 0 0 1 4.2 51c-.2 8.3-3.1 29.3-4.4 32.8-1.3 3.5-2.5 18-2 23.5s3.2 14.3 3 22.2a102 102 0 0 1-1.8 15c-2.3 12-3.4 19.3-4.2 26.5-.8 7.3.1 10.4.5 15.5.3 3.5 3 15 3.4 20 .5 5 2 13-1.5 12.3 0 1.7 0 3-2.5 2.5.5 1.7-1.5 3-2.7 2.7-.3 1-2.5 2-3.5.8-1.3 3-5.8 1.7-6.3-.8s-.2-7-.2-7-.5-.7-.5-5.5c1-6 0-14 0-17.5s-.4-9.5.3-14.8c.8-5.2.2-12.7-.3-17.4-1.1-10.5-4-19.5-4-30 0-7 .4-11.3-1-16.8C8.3 73 6 65.5 6 56.3c-.2-5.8-.7-12-1-16-.2-4-1.8-12-2.2-17-.5-5-.8-13.5-.8-13.5s0 8.5-.5 13.5L-.3 39l-1 15.8c-.3 3.7.5 5.2-2 14.7-2.4 9.5-.2 18.6-1.3 28-1.5 12.6-4 19.4-3.7 32.3 0 0 .7 10.4.7 13 0 2.5 1.8 14.5 2 17.7.3 3.3 2.8 14.5 3 17.3.3 2.7.5 4.7-.7 6-1.3 1.2-4 2.5-5.3 0-1.2 2-3.2.7-3.7-.8-1 1-3 .8-3-1.7-1.8 1.2-2.3-1-3-1.8 0 .8-2.8 1-2.8-3.5v-17c0-4.2.6-17.5.4-22.5-.3-5-.9-13.2-2.1-18-1.3-4.7-4.8-21.7-4.8-21.7s-.6-10.3.9-16c1.4-5.8 1.2-9.8 1.7-13.5.5-3.8-.3-12.3-1-16.8l-3-16s-3.8-19.2-3.6-26.7l1.3-25c0-3.5 0-11.3 1.2-15.5A56.6 56.6 0 0 0-27.5-56l-.5-6Z"/>
</svg>`);
  const shape = data.paths[0].toShapes(true)[0];

  const figureGeom = new THREE.ExtrudeGeometry(shape, { bevelEnabled: false });
  figureGeom.scale(1, -1, 1);
  const outlineGeom = new THREE.EdgesGeometry(figureGeom);

  const figureMaterial = new THREE.MeshBasicMaterial({ color: 0x111111 });
  const outlineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });

  const figureObject = new THREE.Mesh(figureGeom, figureMaterial);
  const outlineObject = new THREE.LineSegments(outlineGeom, outlineMaterial);

  scene.add(figureObject);
  scene.add(outlineObject);

  return { scene, camera };
};

const frame: FrameFn<CanvasState, SketchConfig> = ({
  renderer,
  config,
  state,
}) => {
  if (!renderer || !config) throw new Error('???');

  const { scene, camera } = state;

  renderer.render(scene, camera);
};

export default toCanvasComponent<CanvasState, SketchConfig>(
  init,
  frame,
  sketchbookConfig
);
