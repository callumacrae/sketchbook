import * as THREE from 'three';
import { ARButton } from 'three/examples/jsm/webxr/ARButton';

import SurfaceHandler from '@/utils/web-xr/surface-detection';
import OverlayPlugin from '@/utils/plugins/webxr-overlay';
import TweakpanePlugin from '@/utils/plugins/tweakpane';
import type {
  SketchConfig,
  InitFn,
  InitProps,
  FrameFn,
} from '@/utils/renderers/vanilla';

export const meta = {
  name: 'WebXR surface edge detection',
  date: '2023-02-20',
  tags: ['WebXR', 'Three.js'],
  twitter: 'https://twitter.com/callumacrae/status/1628820514130075648',
};

export interface CanvasState {
  scene: THREE.Scene;
  camera: ReturnType<typeof initCamera>;
  reticle: THREE.Object3D;
  hitTestSource?: XRHitTestSource;
  surfaces: SurfaceHandler;
}

const userConfig = {};
export type UserConfig = typeof userConfig;

const tweakpanePlugin = new TweakpanePlugin();
const overlayPlugin = new OverlayPlugin();

export const sketchConfig: Partial<SketchConfig<CanvasState, UserConfig>> = {
  type: 'threejs',
  xr: {
    enabled: true,
    permissionsButton(renderer: THREE.WebGLRenderer) {
      return ARButton.createButton(renderer, {
        requiredFeatures: ['hit-test', 'depth-sensing'],
        optionalFeatures: ['dom-overlay'],
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        depthSensing: {
          usagePreference: ['cpu-optimized'],
          dataFormatPreference: ['luminance-alpha'],
        },
        domOverlay: { root: overlayPlugin.getRoot() },
      });
    },
  },
  userConfig,
  plugins: [tweakpanePlugin, overlayPlugin],
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

  const reticleGroup = new THREE.Group();
  reticleGroup.matrixAutoUpdate = false;
  reticleGroup.visible = false;
  scene.add(reticleGroup);

  const reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.01, 0.02, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial()
  );
  reticleGroup.add(reticle);

  const surfaces = new SurfaceHandler();
  surfaces.setDebug(true);
  scene.add(surfaces.debugGroup);
  if (!props.renderer) throw new Error('???');
  const controller = props.renderer.xr.getController(0);
  controller.addEventListener('select', () => {
    surfaces.clear();
  });
  scene.add(controller);

  return { scene, camera, reticle: reticleGroup, surfaces };
};

export const frame: FrameFn<CanvasState, UserConfig> = async (props) => {
  const { renderer, userConfig: config, state, xrFrame } = props;
  if (!renderer || !config || !xrFrame) throw new Error('???');

  const referenceSpace = renderer.xr.getReferenceSpace();
  const session = renderer.xr.getSession();
  if (!referenceSpace) throw new Error('???');

  if (!state.hitTestSource && session?.requestHitTestSource) {
    const viewerReferenceSpace = await session.requestReferenceSpace('viewer');
    state.hitTestSource = await session.requestHitTestSource({
      space: viewerReferenceSpace,
    });
  }

  let reticleVisible = false;
  let hitPose: XRPose | undefined = undefined;
  if (state.hitTestSource && referenceSpace) {
    const hitTestResults = xrFrame.getHitTestResults(state.hitTestSource);
    if (hitTestResults.length) {
      const hit = hitTestResults[0];

      hitPose = hit.getPose(referenceSpace);
      if (hitPose) {
        reticleVisible = true;
        state.reticle.matrix.fromArray(hitPose.transform.matrix);
      }
    }
  }
  state.reticle.visible = reticleVisible;

  const viewerPose = xrFrame.getViewerPose(referenceSpace);
  if (viewerPose && reticleVisible && hitPose) {
    const view = viewerPose.views[0];
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const depthInfo = xrFrame.getDepthInformation(view);
    if (depthInfo) {
      const hitTestSurface = state.surfaces.getSurface(hitPose.transform);
      hitTestSurface.learnDepthInfo(state.camera.camera, depthInfo);
    } else {
      overlayPlugin.showWarning('no depth info');
    }
  } else {
    overlayPlugin.showWarning('no pose or reticle not visible');
  }

  renderer.render(state.scene, state.camera.camera);

  return state;
};
