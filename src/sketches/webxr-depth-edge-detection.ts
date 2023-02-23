import * as THREE from 'three';
import { ARButton } from 'three/examples/jsm/webxr/ARButton';
import { interpolatePRGn } from 'd3-scale-chromatic';
import { jStat } from 'jstat';

import OverlayPlugin from '@/utils/plugins/webxr-overlay';
import type {
  Config,
  InitFn,
  InitProps,
  FrameFn,
} from '@/utils/renderers/vanilla';
import * as random from '@/utils/random';

export const meta = {
  name: 'WebXR surface edge detection',
  date: '2023-02-20',
};

interface SurfacePointSample {
  idealDepth: number;
  actualDepth: number;
  adjustedOffset: number;
}

interface SurfacePoint {
  samples: SurfacePointSample[];
  pValue: number;
  mesh?: THREE.Mesh;
}

interface Surface {
  transform: XRRigidTransform;
  points: { [key: string]: SurfacePoint };
}

export interface CanvasState {
  scene: THREE.Scene;
  camera: ReturnType<typeof initCamera>;
  reticle: THREE.Object3D;
  hitTestSource?: XRHitTestSource;
  surfaces: Surface[];
}

const sketchConfig = {};
export type SketchConfig = typeof sketchConfig;

const overlayPlugin = new OverlayPlugin();

export const sketchbookConfig: Partial<Config<CanvasState, SketchConfig>> = {
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
  sketchConfig,
  plugins: [overlayPlugin],
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

export const init: InitFn<CanvasState, SketchConfig> = (props) => {
  props.initControls();
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

  const surfaces: Surface[] = [];
  if (!props.renderer) throw new Error('???');
  const controller = props.renderer.xr.getController(0);
  controller.addEventListener('select', () => {
    for (const surface of surfaces) {
      for (const point of Object.values(surface.points)) {
        if (point.mesh) {
          scene.remove(point.mesh);
        }
      }
    }
    surfaces.splice(0, surfaces.length);
  });
  scene.add(controller);

  return { scene, camera, reticle: reticleGroup, surfaces };
};

const sphereGeometry = new THREE.SphereGeometry(0.001, 32, 32);

export const frame: FrameFn<CanvasState, SketchConfig> = async (props) => {
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
      let hitTestSurface = state.surfaces.find((surface) => {
        const yOffset =
          surface.transform.position.y - hitPose!.transform.position.y;
        // TODO: make tolerance configurable?
        return Math.abs(yOffset) < 0.2;
      });
      if (!hitTestSurface) {
        hitTestSurface = {
          transform: hitPose!.transform,
          points: {},
        };
        state.surfaces.push(hitTestSurface);
      }

      const hitTestSurfaceMatrix = new THREE.Matrix4().fromArray(
        hitTestSurface.transform.matrix
      );
      const resolution = 0.02;

      for (let i = 0; i < 50; i++) {
        const offset = random.range(0, 0.3);
        const angle = random.range(0, Math.PI * 2);

        // x and z expressed in surface space
        const x =
          Math.cos(angle) * offset -
          hitTestSurface.transform.position.x +
          hitPose.transform.position.x;
        const z =
          Math.sin(angle) * offset -
          hitTestSurface.transform.position.z +
          hitPose.transform.position.z;

        const cacheX = Math.round(x / resolution);
        const cacheZ = Math.round(z / resolution);

        const pointKey = `${cacheX},${cacheZ}`;
        let cachedPoint = hitTestSurface.points[pointKey];
        if (cachedPoint && cachedPoint.pValue > 0.9) {
          continue;
        }
        if (!cachedPoint) {
          const sphereMaterial = new THREE.MeshBasicMaterial({
            color: 0x666666,
          });
          const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
          const sphereWorldPosition = new THREE.Vector3(
            cacheX * resolution,
            0,
            cacheZ * resolution
          ).applyMatrix4(hitTestSurfaceMatrix);
          sphere.position.copy(sphereWorldPosition);
          state.scene.add(sphere);

          cachedPoint = {
            samples: [],
            pValue: 0,
            mesh: sphere,
          };
          hitTestSurface.points[pointKey] = cachedPoint;
        }

        // Important note: while we cache at cacheX and cacheZ, we test at x
        // and z
        const worldPosition = new THREE.Vector3(x, 0, z).applyMatrix4(
          hitTestSurfaceMatrix
        );

        const idealDepth = worldPosition.distanceTo(
          state.camera.camera.position
        );

        // Convert to screen coords
        const cameraPosition = worldPosition
          .clone()
          .project(state.camera.camera);
        const screenX = (cameraPosition.x + 1) / 2;
        const screenY = 1 - (cameraPosition.y + 1) / 2;
        if (screenX < 0 || screenX > 1 || screenY < 0 || screenY > 1) {
          continue;
        }
        const actualDepth = depthInfo.getDepthInMeters(screenX, screenY);

        let depthOffset = Math.abs(actualDepth - idealDepth);
        const depthOffsetThreshold = idealDepth / 5;
        if (depthOffset > depthOffsetThreshold) {
          depthOffset -= depthOffsetThreshold;
        } else if (depthOffset < -depthOffsetThreshold) {
          depthOffset += depthOffsetThreshold;
        } else {
          depthOffset = 0;
        }
        cachedPoint.samples.push({
          idealDepth,
          actualDepth,
          adjustedOffset: depthOffset,
        });

        // Calculations are less accurate when further away so if the camera
        // gets closer we want that to take priority over the less accurate
        // samples
        if (cachedPoint.samples.length > 50) {
          cachedPoint.samples.sort((a, b) => a.idealDepth - b.idealDepth);
        }
        const samples = cachedPoint.samples
          .slice(0, 100)
          .map((s) => s.adjustedOffset);

        cachedPoint.pValue = jStat(samples).ztest(0);
        if (
          cachedPoint.mesh &&
          cachedPoint.mesh.material instanceof THREE.MeshBasicMaterial
        ) {
          cachedPoint.mesh.material.color = new THREE.Color(
            interpolatePRGn(
              isNaN(cachedPoint.pValue) ? 0xff0000 : cachedPoint.pValue
            )
          );
        }
      }
    } else {
      overlayPlugin.showWarning('no depth info');
    }
  } else {
    overlayPlugin.showWarning('no pose or reticle not visible');
  }

  renderer.render(state.scene, state.camera.camera);

  return state;
};
