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
  debugSphere: THREE.Mesh;
}

const sketchConfig = {};
type SketchConfig = typeof sketchConfig;

const sketchbookConfig: Partial<Config<SketchConfig>> = {
  type: 'threejs',
  xr: {
    enabled: true,
    permissionsButton(renderer: THREE.WebGLRenderer) {
      return ARButton.createButton(renderer, {
        requiredFeatures: ['depth-sensing'],
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

  const debugSphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0xff0000 })
  );
  debugSphere.visible = false;
  scene.add(debugSphere);

  return { scene, camera, debugSphere };
};

// perform three hit tests in a triangle around the center of the screen
// get the depth at each point

const frame: FrameFn<CanvasState, SketchConfig> = async (props) => {
  const { renderer, config, state, xrFrame } = props;
  if (!renderer || !config || !xrFrame) throw new Error('???');

  const referenceSpace = renderer.xr.getReferenceSpace();
  if (!referenceSpace) throw new Error('???');

  const viewerPose = xrFrame.getViewerPose(referenceSpace);
  if (viewerPose) {
    const view = viewerPose.views[0];
    const depthInfo = xrFrame.getDepthInformation(view);
    if (depthInfo) {
      const depth = depthInfo.getDepthInMeters(0.5, 0.5);

      const position = new THREE.Vector3(0, 0, -depth);
      const viewMatrix = new THREE.Matrix4().fromArray(viewerPose.transform.matrix);

      position.applyMatrix4(viewMatrix);

      // console.log(position.x, position.y, position.z);
      state.debugSphere.visible = true;
      state.debugSphere.position.copy(position);
    } else {
      console.log('no depth info');
    }
  } else {
    console.log('no pose');
  }

  renderer.render(state.scene, state.camera.camera);

  return state;
};

export default toCanvasComponent<CanvasState, SketchConfig>(
  init,
  frame,
  sketchbookConfig
);
