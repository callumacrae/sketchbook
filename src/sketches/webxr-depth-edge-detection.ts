import * as THREE from 'three';
import { ARButton } from 'three/examples/jsm/webxr/ARButton';
import { HTMLMesh } from 'three/examples/jsm/interactive/HTMLMesh';
import { interpolatePRGn } from 'd3-scale-chromatic';

import { toCanvasComponent } from '@/utils/renderers/vue';
import type {
  Config,
  InitFn,
  InitProps,
  FrameFn,
} from '@/utils/renderers/vanilla';

export const meta = {
  name: 'WebXR surface edge detection',
  date: '2023-02-20',
};

interface CanvasState {
  scene: THREE.Scene;
  camera: ReturnType<typeof initCamera>;
  reticle: THREE.Object3D;
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
        requiredFeatures: ['hit-test', 'depth-sensing'],
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

const labelElements: HTMLDivElement[] = [];

const init: InitFn<CanvasState, SketchConfig> = (props) => {
  // props.initControls(({ pane, config }) => {
  // });

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

  const sateliteGeometry = new THREE.RingGeometry(0.005, 0.01, 32).rotateX(
    -Math.PI / 2
  );
  const sateliteCount = 6;
  const radius = 0.15;
  for (let i = 0; i < sateliteCount; i++) {
    const sateliteMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const satelite = new THREE.Mesh(sateliteGeometry, sateliteMaterial);
    satelite.name = `satelite-${i}`;
    const angle = ((Math.PI * 2) / sateliteCount) * i;
    satelite.position.set(
      Math.cos(angle) * radius,
      0,
      Math.sin(angle) * radius
    );
    reticleGroup.add(satelite);

    const sateliteLabelElement = document.createElement('div');
    sateliteLabelElement.textContent = '0.99/0.99';
    sateliteLabelElement.style.color = '#fff';
    sateliteLabelElement.style.background = '#000';
    sateliteLabelElement.style.visibility = 'hidden';
    document.body.appendChild(sateliteLabelElement);
    labelElements.push(sateliteLabelElement);

    const sateliteLabel = new HTMLMesh(sateliteLabelElement);
    sateliteLabel.position.set(satelite.position.x, 0.02, satelite.position.z);
    reticleGroup.add(sateliteLabel);
  }

  return { scene, camera, reticle: reticleGroup };
};

const frame: FrameFn<CanvasState, SketchConfig> = async (props) => {
  const { renderer, config, state, xrFrame } = props;
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
  if (state.hitTestSource && referenceSpace) {
    const hitTestResults = xrFrame.getHitTestResults(state.hitTestSource);
    if (hitTestResults.length) {
      const hit = hitTestResults[0];

      const hitPose = hit.getPose(referenceSpace);
      if (hitPose) {
        reticleVisible = true;
        state.reticle.matrix.fromArray(hitPose.transform.matrix);
      }
    }
  }
  state.reticle.visible = reticleVisible;

  const viewerPose = xrFrame.getViewerPose(referenceSpace);
  if (viewerPose && reticleVisible) {
    const view = viewerPose.views[0];
    const depthInfo = xrFrame.getDepthInformation(view);
    if (depthInfo) {
      // const depthAtCenter = depthInfo.getDepthInMeters(0.5, 0.5);

      const satelites = state.reticle.children.filter(
        (child) =>
          child.name.startsWith('satelite-') && !('isHTMLMesh' in child)
      );
      for (const satelite of satelites) {
        if (!(satelite instanceof THREE.Mesh)) continue;

        const position = new THREE.Vector3();
        position.setFromMatrixPosition(satelite.matrixWorld);
        const idealDepth = position.distanceTo(state.camera.camera.position);

        // Convert to screen coords
        position.project(state.camera.camera);
        const x = (position.x + 1) / 2;
        const y = 1 - (position.y + 1) / 2;
        if (x < 0 || x > 1 || y < 0 || y > 1) {
          satelite.material.color = new THREE.Color(0x666666);
          continue;
        }
        const actualDepth = depthInfo.getDepthInMeters(x, y);

        const depthOffset = Math.abs(actualDepth - idealDepth);

        satelite.material.color = new THREE.Color(interpolatePRGn(depthOffset));

        const labelEl = labelElements[Number(satelite.name.split('-')[1])];
        labelEl.textContent = `${actualDepth.toFixed(2)}/${idealDepth.toFixed(2)}`;
      }
    } else {
      console.log('no depth info');
    }
  } else {
    console.log('no pose or reticle not visible');
  }

  renderer.render(state.scene, state.camera.camera);

  return state;
};

export default toCanvasComponent<CanvasState, SketchConfig>(
  init,
  frame,
  sketchbookConfig
);
