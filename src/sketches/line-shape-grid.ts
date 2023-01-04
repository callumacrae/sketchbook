import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

import * as random from '@/utils/random';
import { toCanvasComponent } from '@/utils/renderers/vue';
import type {
  Config,
  InitFn,
  InitProps,
  FrameFn,
  FrameProps,
} from '@/utils/renderers/vanilla';

interface CanvasState {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  shapes: ReturnType<typeof initShapes>;
}

const sketchConfig = {
  rotationSpeed: 0.0025,
  sphereRadius: 20,
  shapeOffset: 4,
  shapeSize: 2,
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
  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 60);
  camera.position.z = 30;
  scene.add(camera);
  return camera;
}

const getCoords = (p: number) => [
  p % 3,
  Math.floor(p / 3) % 3,
  Math.floor(p / 9),
];

const shapeMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
const nodeGeometry = new THREE.SphereGeometry(0.1, 4, 4);
const edgeGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1, 4, 1, true);

function generateShape() {
  const shape = new THREE.Group();

  // The shape is represented by 26 points with IDs as follows:
  //
  // p = 9 * z + 3 * y + x
  // z = 0    z = 1      z = 2
  // 0 1 2    9 10 11   18 19 20
  // 3 4 5   12 13 14   21 22 23
  // 6 7 8   15 16 17   24 25 26

  const filled = [13];

  const centerNodeObject = new THREE.Mesh(nodeGeometry, shapeMaterial);
  centerNodeObject.position.set(0, 0, 0);
  shape.add(centerNodeObject);

  // TODO: try checking already searched ones, don't search again - won't bias middle
  for (let i = 0; i < 3; i++) {
    const chance = 1 / (i + 2);

    const newFilled = new Set<number>();

    for (let j = 0; j <= 26; j++) {
      if (filled.includes(j)) continue;

      const [x, y, z] = getCoords(j);

      const neighbours = Array.from(filled).filter((filledPoint) => {
        const [filledPointX, filledPointY, filledPointZ] =
          getCoords(filledPoint);

        return (
          (filledPointX === x &&
            filledPointY === y &&
            Math.abs(filledPointZ - z) === 1) ||
          (filledPointX === x &&
            Math.abs(filledPointY - y) === 1 &&
            filledPointZ === z) ||
          (Math.abs(filledPointX - x) === 1 &&
            filledPointY === y &&
            filledPointZ === z)
        );
      });

      if (neighbours.length && random.value() < chance) {
        newFilled.add(j);

        const nodeObject = new THREE.Mesh(nodeGeometry, shapeMaterial);
        nodeObject.position.set(x - 1, y - 1, z - 1);
        shape.add(nodeObject);

        const neighbour = random.pick(neighbours);
        const [neighbourX, neighbourY, neighbourZ] = getCoords(neighbour);

        const edgeObject = new THREE.Mesh(edgeGeometry, shapeMaterial);

        if (x !== neighbourX) {
          edgeObject.rotateZ(Math.PI / 2);
          edgeObject.position.set(Math.min(x, neighbourX) - 0.5, y - 1, z - 1);
        } else if (y !== neighbourY) {
          edgeObject.rotateY(Math.PI / 2);
          edgeObject.position.set(x - 1, Math.min(y, neighbourY) - 0.5, z - 1);
        } else {
          edgeObject.rotateX(Math.PI / 2);
          edgeObject.position.set(x - 1, y - 1, Math.min(z, neighbourZ) - 0.5);
        }

        shape.add(edgeObject);
      }
    }

    filled.push(...newFilled);
  }

  return shape;
}

function initShapes(scene: THREE.Scene, { config }: InitProps<SketchConfig>) {
  if (!config) throw new Error('???');

  const shapes = new THREE.Group();

  const scale = config.shapeSize / 2;
  const offset = config.shapeOffset;

  const toGenerate = 5;

  for (let x = -toGenerate; x <= toGenerate; x++) {
    for (let y = -toGenerate; y <= toGenerate; y++) {
      for (let z = -toGenerate; z <= toGenerate; z++) {
        const distToCenter = Math.sqrt(
          Math.pow(x, 2) + Math.pow(y, 2) + Math.pow(z, 2)
        );

        const shape = generateShape();
        shape.scale.set(scale, scale, scale);
        shape.position.set(x * offset, y * offset, z * offset);
        shape.visible = distToCenter * offset < config.sphereRadius;
        shapes.add(shape);

        shape.userData.unoffsetPosition = [x, y, z];
        shape.userData.distToCenter = distToCenter;
      }
    }
  }

  scene.add(shapes);

  const frame = (props: FrameProps<CanvasState, SketchConfig>) => {
    if (!props.config) throw new Error('???');
    shapes.rotateY((props.config.rotationSpeed / 16.6) * props.delta);

    if (props.hasChanged) {
      const scale = config.shapeSize / 2;
      const offset = config.shapeOffset;

      for (const shape of shapes.children) {
        shape.scale.set(scale, scale, scale);
        const [x, y, z] = shape.userData.unoffsetPosition;
        shape.position.set(x * offset, y * offset, z * offset);
        shape.visible =
          shape.userData.distToCenter * offset < config.sphereRadius;
      }
    }
  };

  return { frame };
}

const init: InitFn<CanvasState, SketchConfig> = (props) => {
  if (!props.renderer) throw new Error('???');

  props.initControls(({ pane, config }) => {
    pane.addInput(config, 'rotationSpeed', { min: 0, max: 0.05 });
    pane.addInput(config, 'sphereRadius', { min: 2, max: 40 });
    pane.addInput(config, 'shapeOffset', { min: 0, max: 10 });
    pane.addInput(config, 'shapeSize', { min: 0.1, max: 10 });
  });

  // TODO: Enable this and make sure none of the shapes are too nazi
  // random.setSeed('blabla');

  const scene = new THREE.Scene();

  const camera = initCamera(scene, props);
  new OrbitControls(camera, props.renderer.domElement);

  const shapes = initShapes(scene, props);

  return { scene, camera, shapes };
};

const frame: FrameFn<CanvasState, SketchConfig> = (props) => {
  const { renderer, config, state } = props;
  if (!renderer || !config) throw new Error('???');

  state.shapes.frame(props);

  renderer.render(state.scene, state.camera);
};

export default toCanvasComponent<CanvasState, SketchConfig>(
  init,
  frame,
  sketchbookConfig
);
