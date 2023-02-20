import * as THREE from 'three';
import { ARButton } from 'three/examples/jsm/webxr/ARButton';

import { toCanvasComponent } from '@/utils/renderers/vue';
import type {
  Config,
  InitFn,
  InitProps,
  FrameFn,
} from '@/utils/renderers/vanilla';

export const meta = {
  name: 'Hello world (WebXR)',
  date: '2023-02-17',
};

interface CanvasState {
  scene: THREE.Scene;
  camera: ReturnType<typeof initCamera>;
  reticle: THREE.Mesh;
  hitTestSource?: XRHitTestSource;
}

const sketchConfig = {};
type SketchConfig = typeof sketchConfig;

const sketchbookConfig: Partial<Config<SketchConfig>> = {
  type: 'threejs',
  xr: {
    enabled: true,
    permissionsButton(renderer: THREE.WebGLRenderer) {
      return ARButton.createButton(renderer, {
        requiredFeatures: ['depth-sensing', 'hit-test'],
        depthSensing: {
          usagePreference: ['cpu-optimized'],
          dataFormatPreference: ['luminance-alpha'],
        },
      });
    },
  },
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

const init: InitFn<CanvasState, SketchConfig> = (props) => {
  // props.initControls(({ pane, config }) => {
  // });

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

  return { scene, camera, reticle };
};

const frame: FrameFn<CanvasState, SketchConfig> = async (props) => {
  const { renderer, config, state, xrFrame } = props;
  if (!renderer || !config || !xrFrame) throw new Error('???');

  const referenceSpace = renderer.xr.getReferenceSpace();
  const session = renderer.xr.getSession();

  if (!state.hitTestSource && session?.requestHitTestSource) {
    const viewerReferenceSpace = await session.requestReferenceSpace('viewer');
    state.hitTestSource = await session.requestHitTestSource({
      space: viewerReferenceSpace,
    });
    console.log('hit test source created');
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
      } else {
        console.log('no hit pose');
      }
    } else {
      console.log('no hit test results');
    }
  }
  if (!reticleVisible) {
    state.reticle.visible = false;
  }

  // const viewerPose = xrFrame.getViewerPose(referenceSpace);
  // if (viewerPose) {
  //   const view = viewerPose.views[0];
  //   const depthInfo = xrFrame.getDepthInformation(view);
  //   if (depthInfo) {
  //     // console.log(depthInfo);
  //   }
  // }

  renderer.render(state.scene, state.camera.camera);

  window.sketchState = state;
  return state;
};

export default toCanvasComponent<CanvasState, SketchConfig>(
  init,
  frame,
  sketchbookConfig
);
