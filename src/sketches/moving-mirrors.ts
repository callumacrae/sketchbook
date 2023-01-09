import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import SimplexNoise from 'simplex-noise';

import { toCanvasComponent } from '@/utils/renderers/vue';
import type {
  Config,
  InitFn,
  InitProps,
  FrameFn,
} from '@/utils/renderers/vanilla';

interface CanvasState {
  simplex: SimplexNoise;
  scene: THREE.Scene;
  camera: ReturnType<typeof initCamera>;
  mirrors: ReturnType<typeof initMirrors>;
}

const sketchConfig = {
  noiseXInFactor: 0.07,
  noiseYInFactor: 0.07,
  noiseAngleTimeInFactor: 0.1,
  noiseTiltTimeInFactor: 0.1,
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
  camera.position.z = 17;
  scene.add(camera);

  return { camera };
}

function initLighting(scene: THREE.Scene) {
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
  directionalLight.position.set(0, 0, 10);
  scene.add(directionalLight);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
  scene.add(ambientLight);
}

function initFloor(scene: THREE.Scene) {
  const floorGeometry = new THREE.PlaneGeometry(100, 100);
  const floorMaterial = new THREE.MeshPhongMaterial({ color: 0xaaaaaa });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.z = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
}

function createMirror() {
  const mirror = new THREE.Group();

  // To ensure that angle is applied before tilt
  mirror.rotation.order = 'ZYX';

  const backGeometry = new THREE.SphereGeometry(1, 32, 32, 0, Math.PI);
  const backMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
  const backObject = new THREE.Mesh(backGeometry, backMaterial);
  backObject.castShadow = true;
  backObject.receiveShadow = true;
  backObject.rotateX(Math.PI);

  const faceGeometry = new THREE.CircleGeometry(1, 32);
  const faceMaterial = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    emissive: new THREE.Color(0xffffff),
  });
  const faceObject = new THREE.Mesh(faceGeometry, faceMaterial);
  faceObject.rotation.y = Math.PI;
  faceObject.rotateX(Math.PI);

  const mirrorLight = new THREE.PointLight(0xffffff, 1, 40);
  mirrorLight.position.set(0, 0, -0.3);
  mirrorLight.castShadow = true;
  mirror.add(mirrorLight);

  mirror.add(backObject);
  mirror.add(faceObject);

  return mirror;
}

function initMirrors(scene: THREE.Scene) {
  const mirrorsGroup = new THREE.Group();

  const mirrorsX = 3;
  const mirrorsY = 3;
  const spacingX = 4.5;
  const spacingY = 4.5;

  for (let x = 0; x < mirrorsX; x++) {
    for (let y = 0; y < mirrorsY; y++) {
      const mirror = createMirror();
      mirror.position.set(
        (x - mirrorsX / 2 + 0.5) * spacingX,
        (y - mirrorsY / 2 + 0.5) * spacingY,
        0.5
      );

      mirror.rotation.x = Math.PI / 4;

      mirrorsGroup.add(mirror);
    }
  }

  scene.add(mirrorsGroup);

  const frame: FrameFn<CanvasState, SketchConfig> = (props) => {
    const { timestamp, state, config } = props;
    if (!config) throw new Error('???');

    const t = timestamp / 1e3;

    mirrorsGroup.children.forEach((mirror) => {
      if (!(mirror instanceof THREE.Group)) return;

      const { x, y } = mirror.position;

      const angleNoise = state.simplex.noise3D(
        x * config.noiseXInFactor,
        y * config.noiseYInFactor,
        t * config.noiseAngleTimeInFactor
      );
      mirror.rotation.z = angleNoise * Math.PI;

      const tiltNoise = state.simplex.noise3D(
        x * config.noiseXInFactor,
        y * config.noiseYInFactor,
        t * config.noiseTiltTimeInFactor + 100
      );
      mirror.rotation.x = (tiltNoise * Math.PI) / 2;
    });
  };

  return { frame };
}

const init: InitFn<CanvasState, SketchConfig> = (props) => {
  if (!props.renderer) throw new Error('???');

  props.initControls(({ pane, config }) => {
    pane.addInput(config, 'noiseXInFactor', { min: 0, max: 1 });
    pane.addInput(config, 'noiseYInFactor', { min: 0, max: 1 });
    pane.addInput(config, 'noiseAngleTimeInFactor', { min: 0, max: 1 });
    pane.addInput(config, 'noiseTiltTimeInFactor', { min: 0, max: 1 });
  });

  props.renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();

  const camera = initCamera(scene, props);
  new OrbitControls(camera.camera, props.renderer.domElement);

  initLighting(scene);
  initFloor(scene);
  const mirrors = initMirrors(scene);

  return { simplex: new SimplexNoise('seed'), scene, camera, mirrors };
};

const frame: FrameFn<CanvasState, SketchConfig> = (props) => {
  const { renderer, config, state } = props;
  if (!renderer || !config) throw new Error('???');

  state.mirrors.frame(props);

  renderer.render(state.scene, state.camera.camera);
};

export default toCanvasComponent<CanvasState, SketchConfig>(
  init,
  frame,
  sketchbookConfig
);
