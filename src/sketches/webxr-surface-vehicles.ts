import * as THREE from 'three';

import Vector from '@/utils/vector';
import Vehicle from '@/utils/vehicle/vehicle';
import VehicleGroup from '@/utils/vehicle/vehicle-group';
import SurfaceHandler from '@/utils/web-xr/surface-detection';
import * as random from '@/utils/random';
import OverlayPlugin from '@/utils/plugins/webxr-overlay';
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
  name: 'WebXR surface with vehicles',
  date: '2023-02-27',
  tags: ['WebXR', 'Three.js', 'Boids'],
  twitter: 'https://twitter.com/callumacrae/status/1631671993081769987',
};

class ThreeSurfaceVehicle extends Vehicle {
  mesh: THREE.Mesh;

  constructor({
    position,
    velocity,
    mesh,
  }: {
    position: Vector;
    velocity: Vector;
    mesh: THREE.Mesh;
  }) {
    super({ position, velocity });
    this.mesh = mesh;
  }

  step(dt: number, timeSinceLastCalled?: number, maxSubSteps = 10) {
    super.step(dt, timeSinceLastCalled, maxSubSteps);

    this.mesh.rotation.set(0, this.velocity.angle() + Math.PI, 0);
    this.mesh.position.set(this.position.x, 0, -this.position.y);
  }
}

export interface CanvasState {
  scene: THREE.Scene;
  camera: ReturnType<typeof initCamera>;
  reticle: THREE.Object3D;
  hitTestSource?: XRHitTestSource;
  surfaces: SurfaceHandler;
  boids: VehicleGroup;
  boidsGroup: THREE.Group;
}

const userConfig = {
  boids: {
    count: 10,
    minVelocity: 0.03,
    maxVelocity: 0.1,
    maxForce: 0.3,
  },
  neighbours: {
    distance: 0.1,
  },
  behaviours: {
    seekWeight: 5,
    fleeWeight: 5,
    separationWeight: 0.5,
    cohesionWeight: 0.4,
    alignmentWeight: 0.6,
    wanderWeight: 0.1,
    wanderVariance: 0.2,
    avoidWallsLookAhead: 1,
    avoidWallsWeight: 5,
  },
};
export type UserConfig = typeof userConfig;

const tweakpanePlugin = new TweakpanePlugin<CanvasState, UserConfig>(
  ({ pane, config }) => {
    const boidsFolder = pane.addFolder({ title: 'Boids' });
    boidsFolder.addInput(config.boids, 'count', { min: 1, max: 1000, step: 1 });
    boidsFolder.addInput(config.boids, 'minVelocity', {
      min: 0,
      max: 1000,
    });
    boidsFolder.addInput(config.boids, 'maxVelocity', {
      min: 0,
      max: 1000,
    });
    boidsFolder.addInput(config.boids, 'maxForce', { min: 0, max: 4000 });

    const neighboursFolder = pane.addFolder({ title: 'Neighbours' });
    neighboursFolder.addInput(config.neighbours, 'distance', {
      min: 0,
      max: 500,
    });

    const behavioursFolder = pane.addFolder({ title: 'Behaviours' });
    // behavioursFolder.addInput(config.behaviours, 'seekWeight', {
    //   min: 0,
    //   max: 20,
    // });
    // behavioursFolder.addInput(config.behaviours, 'fleeWeight', {
    //   min: 0,
    //   max: 20,
    // });
    behavioursFolder.addInput(config.behaviours, 'separationWeight', {
      min: 0,
      max: 2,
    });
    behavioursFolder.addInput(config.behaviours, 'cohesionWeight', {
      min: 0,
      max: 2,
    });
    behavioursFolder.addInput(config.behaviours, 'alignmentWeight', {
      min: 0,
      max: 2,
    });
    behavioursFolder.addInput(config.behaviours, 'wanderWeight', {
      min: 0,
      max: 2,
    });
    behavioursFolder.addInput(config.behaviours, 'wanderVariance', {
      min: 0,
      max: 0.5,
    });
    behavioursFolder.addInput(config.behaviours, 'avoidWallsLookAhead', {
      min: 0,
      max: 4,
    });
    behavioursFolder.addInput(config.behaviours, 'avoidWallsWeight', {
      min: 0,
      max: 10,
    });
  }
);

const threePlugin = new ThreePlugin(THREE);
const overlayPlugin = new OverlayPlugin();
const threeXRPlugin = new ThreeXRPlugin({
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

export const sketchConfig: Partial<SketchConfig<CanvasState, UserConfig>> = {
  type: 'custom',
  userConfig,
  plugins: [threePlugin, tweakpanePlugin, overlayPlugin, threeXRPlugin],
};

const boidGeometry = new THREE.BufferGeometry();
const boidGeometryVertices = new Float32Array([
  0, 0, 0, -0.5, 0, 1.2, 0.5, 0, 1.2,
]);
boidGeometry.setAttribute(
  'position',
  new THREE.BufferAttribute(boidGeometryVertices, 3)
);
boidGeometry.scale(0.01, 0.01, 0.01);
const boidMaterial = new THREE.MeshBasicMaterial({
  color: 0x333333,
});
function newBoid() {
  return new ThreeSurfaceVehicle({
    position: Vector.fromAngle(
      random.range(0, Math.PI * 2),
      random.range(0, 0.2)
    ),
    // position: new Vector(0, 0),
    velocity: Vector.fromAngle(
      random.range(0, Math.PI * 2),
      random.range(userConfig.boids.minVelocity, userConfig.boids.maxVelocity)
    ),
    // velocity: new Vector(-userConfig.boids.maxVelocity, -0.03),
    mesh: new THREE.Mesh(boidGeometry, boidMaterial),
  });
}

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

  const controller = renderer.xr.getController(0);
  controller.addEventListener('select', () => {
    for (let i = 0; i < 1; i++) {
      const boid = newBoid();
      boids.addVehicle(boid);
      boidsGroup.add(boid.mesh);
    }
  });
  scene.add(controller);

  const boids = new VehicleGroup();
  const boidsGroup = new THREE.Group();
  boidsGroup.matrixAutoUpdate = false;
  scene.add(boidsGroup);

  return { scene, camera, reticle: reticleGroup, surfaces, boids, boidsGroup };
};

export const frame: FrameFn<CanvasState, UserConfig> = async (props) => {
  const { userConfig: config, state, delta, hasChanged } = props;
  const { renderer } = threePlugin;
  const { xrFrame } = threeXRPlugin;
  if (!renderer || !config || !xrFrame) throw new Error('???');

  if (hasChanged) {
    state.boids.setSeparation(config.behaviours.separationWeight);
    state.boids.setCohesion(config.behaviours.cohesionWeight);
    state.boids.setAlignment(config.behaviours.alignmentWeight);
    state.boids.setWander(
      config.behaviours.wanderWeight,
      config.behaviours.wanderVariance
    );

    state.boids.minVelocity = config.boids.minVelocity;
    state.boids.maxVelocity = config.boids.maxVelocity;
    state.boids.maxForce = config.boids.maxForce;

    state.boids.neighbourDistance = config.neighbours.distance;

    // const boidCountOffset = config.boids.count - state.boids.vehicles.length;
  }

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
      if (state.surfaces.surfaces.indexOf(hitTestSurface) !== 0) {
        // TODO: better handling?
        return;
      }
      hitTestSurface.learnDepthInfo(state.camera.camera, depthInfo);

      // TODO: perf improvement
      if (state.boids.vehicles.length === 0) {
        state.boidsGroup.matrix.fromArray(hitPose.transform.matrix);
      }

      const hitsWall = (current: Vector, ahead: Vector) => {
        const tests = 4;
        for (let i = 1; i <= tests; i++) {
          const t = i / tests;

          const x = current.x + ahead.x * t;
          const z = -(current.y + ahead.y * t);

          // TODO: why does this happen??
          if (isNaN(x) || isNaN(z)) {
            return 0;
          }

          const pValue = hitTestSurface.testPoint(x, z);
          if (pValue < 0.8) {
            return t;
          }
        }

        return false;
      };

      state.boids.setAvoidWalls({
        hitsWall,
        lookAhead: config.behaviours.avoidWallsLookAhead,
        emergency: new Vector(0, 0),
        weight: config.behaviours.avoidWallsWeight,
      });
    } else {
      overlayPlugin.showWarning('no depth info');
    }
  } else {
    overlayPlugin.showWarning('no pose or reticle not visible');
  }

  state.boids.step(1 / 60, delta / 1000, 3);

  renderer.render(state.scene, state.camera.camera);

  return state;
};
