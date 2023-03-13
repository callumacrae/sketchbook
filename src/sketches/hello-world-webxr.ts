import * as THREE from 'three';

import ThreePlugin from '@/utils/plugins/three';
import TweakpanePlugin from '@/utils/plugins/tweakpane';
import ThreeXRPlugin from '@/utils/plugins/three-xr';
import type {
  SketchConfig,
  InitFn,
  InitProps,
  FrameFn,
} from '@/utils/renderers/vanilla';

export const meta = {
  name: 'Hello world (WebXR)',
  date: '2023-02-17',
  tags: ['WebXR', 'Three.js', 'Hello World'],
};

export interface CanvasState {
  scene: THREE.Scene;
  camera: ReturnType<typeof initCamera>;
  reticle: THREE.Mesh;
  hitTestSource?: XRHitTestSource;
}

const userConfig = {};
export type UserConfig = typeof userConfig;

const tweakpanePlugin = new TweakpanePlugin();
const threeXRPlugin = new ThreeXRPlugin({
  requiredFeatures: ['hit-test'],
  // requiredFeatures: ['depth-sensing', 'hit-test'],
  // depthSensing: {
  //   usagePreference: ['cpu-optimized'],
  //   dataFormatPreference: ['luminance-alpha'],
  // },
});
const threePlugin = new ThreePlugin(THREE);

export const sketchConfig: Partial<SketchConfig<CanvasState, UserConfig>> = {
  type: 'custom',
  userConfig,
  plugins: [threePlugin, tweakpanePlugin, threeXRPlugin],
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
  const { renderer } = threePlugin;
  if (!renderer) throw new Error('???');

  const scene = new THREE.Scene();

  const camera = initCamera(scene, props);
  initLighting(scene);

  const reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial()
  );
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);

  const geometry = new THREE.CylinderGeometry(0.1, 0.1, 0.2, 32).translate(
    0,
    0.1,
    0
  );

  function onSelect() {
    if (!reticle.visible) return;
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff * Math.random(),
    });
    const mesh = new THREE.Mesh(geometry, material);
    reticle.matrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
    mesh.scale.y = Math.random() * 2 + 1;
    scene.add(mesh);
  }

  const controller = renderer.xr.getController(0);
  controller.addEventListener('select', onSelect);
  scene.add(controller);

  return { scene, camera, reticle };
};

export const frame: FrameFn<CanvasState, UserConfig> = async (props) => {
  const { userConfig: config, state } = props;
  const { renderer } = threePlugin;
  const { xrFrame } = threeXRPlugin;

  if (!renderer || !config || !xrFrame) throw new Error('???');

  const referenceSpace = renderer.xr.getReferenceSpace();
  const session = renderer.xr.getSession();

  if (!state.hitTestSource && session?.requestHitTestSource) {
    const viewerReferenceSpace = await session.requestReferenceSpace('viewer');
    state.hitTestSource = await session.requestHitTestSource({
      space: viewerReferenceSpace,
    });
  }

  let reticleVisible = false;
  if (state.hitTestSource && referenceSpace) {
    const hitTestResults = xrFrame.getHitTestResults(state.hitTestSource);
    if (hitTestResults.length) {
      const hit = hitTestResults[0];

      const hitPose = hit.getPose(referenceSpace);
      if (hitPose) {
        reticleVisible = true;
        state.reticle.visible = true;
        state.reticle.matrix.fromArray(hitPose.transform.matrix);
      }
    }
  }
  if (!reticleVisible) {
    state.reticle.visible = false;
  }

  renderer.render(state.scene, state.camera.camera);

  return state;
};
