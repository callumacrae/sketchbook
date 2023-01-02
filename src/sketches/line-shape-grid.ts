import * as THREE from 'three';
import { MeshLineGeometry, MeshLineMaterial } from 'meshline';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

import * as random from '@/utils/random';
import { toCanvasComponent } from '@/utils/renderers/vue';
import type {
  Config,
  InitFn,
  InitProps,
  FrameFn,
} from '@/utils/renderers/vanilla';

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

function initCamera(
  scene: THREE.Scene,
  { width, height }: InitProps<SketchConfig>
) {
  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 100);
  camera.position.z = 5;
  scene.add(camera);
  return camera;
}

function generateShape() {
  const shape = new THREE.Group();

  // start with center
  // go out in all six directions, random chance of each
  // for all remaining points,

  // p = 9 * z + 3 * y + x
  // z = 0    z = 1      z = 2
  // 0 1 2    9 10 11   18 19 20
  // 3 4 5   12 13 14   21 22 23
  // 6 7 8   15 16 17   24 25 26

  const filled = [13];

  // TODO: try checking already searched ones, don't search again - won't bias middle
  for (let i = 0; i < 3; i++) {
    const chance = 1 / (i + 2);

    const newFilled = new Set<number>();

    for (let j = 0; j <= 26; j++) {
      if (filled.includes(j)) continue;

      // todo: abstract out
      const x = j % 3;
      const y = Math.floor(j / 3) % 3;
      const z = Math.floor(j / 9);

      const neighbours = Array.from(filled).filter((filledPoint) => {
        const filledPointX = filledPoint % 3;
        const filledPointY = Math.floor(filledPoint / 3) % 3;
        const filledPointZ = Math.floor(filledPoint / 9);

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

      if (neighbours.length && Math.random() < chance) {
        newFilled.add(j);

        const neighbour = random.pick(neighbours);
        const neighbourX = neighbour % 3;
        const neighbourY = Math.floor(neighbour / 3) % 3;
        const neighbourZ = Math.floor(neighbour / 9);

        // TODO: Use TubeGeometry instead
        const geometry = new MeshLineGeometry();
        geometry.setPoints([
          [x, y, z],
          [neighbourX, neighbourY, neighbourZ],
        ]);
        geometry.translate(-1, -1, -1);
        const material = new MeshLineMaterial({
          color: 0xff0000,
          lineWidth: 0.1,
          resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
        });
        const line = new THREE.Mesh(geometry, material);
        shape.add(line);
      }
    }

    filled.push(...newFilled);
  }

  console.log(filled);

  return shape;
}

const init: InitFn<CanvasState, SketchConfig> = (props) => {
  if (!props.renderer) throw new Error('???');

  // props.initControls(({ pane, config }) => {
  // });

  const scene = new THREE.Scene();

  const camera = initCamera(scene, props);
  new OrbitControls(camera, props.renderer.domElement);

  const shape = generateShape();
  scene.add(shape);

  return { scene, camera };
};

const frame: FrameFn<CanvasState, SketchConfig> = (props) => {
  const { renderer, config, state } = props;
  if (!renderer || !config) throw new Error('???');

  renderer.render(state.scene, state.camera);
};

export default toCanvasComponent<CanvasState, SketchConfig>(
  init,
  frame,
  sketchbookConfig
);
