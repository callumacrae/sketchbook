import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { mergeBufferGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils';
import SimplexNoise from 'simplex-noise';

import * as random from '@/utils/random';
import { toCanvasComponent } from '@/utils/renderers/vue';
import { extendMaterial } from '@/utils/three-extend-material';
import type {
  Config,
  InitFn,
  InitProps,
  FrameFn,
  FrameProps,
} from '@/utils/renderers/vanilla';

const glsl = String.raw;

interface CanvasState {
  simplex: SimplexNoise;
  scene: THREE.Scene;
  camera: ReturnType<typeof initCamera>;
  shapes: ReturnType<typeof initShapes>;
  highlighter: ReturnType<typeof initHighlighter>;
}

const sketchConfig = {
  rotationSpeed: 1,
  sphereRadius: 20,
  shapeOffset: 4,
  shapeSize: 2,
  highlighterNoiseInFactor: 1 / 50,
  highlighterNoiseOutFactor: 0.5,
};
type SketchConfig = typeof sketchConfig;

const sketchbookConfig: Partial<Config<SketchConfig>> = {
  type: 'threejs',
  sketchConfig,
};

function initCamera(
  scene: THREE.Scene,
  { width, height, renderer }: InitProps<SketchConfig>
) {
  if (!renderer) throw new Error('???');

  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 60);
  camera.position.y = 5;
  camera.position.z = 30;
  scene.add(camera);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.autoRotate = true;

  const frame = (props: FrameProps<CanvasState, SketchConfig>) => {
    if (props.hasChanged && props.config) {
      controls.autoRotateSpeed = props.config.rotationSpeed;
    }
    controls.update();
  };

  return { camera, frame };
}

const getCoords = (p: number) => [
  p % 3,
  Math.floor(p / 3) % 3,
  Math.floor(p / 9),
];

const shapeMaterial = extendMaterial(THREE.MeshBasicMaterial, {
  class: THREE.ShaderMaterial,

  vertexHeader: glsl`
    attribute vec3 aCenter;
    varying vec3 vCenter;
  `,

  vertex: {
    transformEnd: glsl`
      vCenter = aCenter;
    `,
  },

  fragmentHeader: glsl`
    uniform mat4 uHighlighterMatrixWorld;
    varying vec3 vCenter;
  `,

  fragment: {
    '#include <color_fragment>': glsl`
      vec3 transformedCenter = (vec4(vCenter, 1.0) * uHighlighterMatrixWorld).xyz;

      if (abs(transformedCenter.x) < 8.0 && abs(transformedCenter.z) < 8.0) {
        diffuseColor.rgb = vec3(1.0, 0.2, 0.2);
      } else {
        diffuseColor.rgb = vec3(0.35, 0.3, 0.3);
      }
    `,
  },

  // For when instancing is used
  // vertex: {
  //   '#include <color_vertex>': glsl`
  //     vColor.g = 0.0;
  //   `,
  // },

  uniforms: {
    uHighlighterMatrixWorld: {
      shared: true,
      value: new THREE.Matrix4(),
    },
  },
});
const nodeGeometry = new THREE.SphereGeometry(0.1, 8, 8);
const edgeGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1, 8, 1, true);

function generateShape() {
  const shapeGeometries = [nodeGeometry.clone()];

  // The shape is represented by 26 points with IDs as follows:
  //
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

        const node = nodeGeometry.clone();
        node.translate(x - 1, y - 1, z - 1);
        shapeGeometries.push(node);

        const neighbour = random.pick(neighbours);
        const [neighbourX, neighbourY, neighbourZ] = getCoords(neighbour);

        const edge = edgeGeometry.clone();

        if (x !== neighbourX) {
          edge.rotateZ(Math.PI / 2);
          edge.translate(Math.min(x, neighbourX) - 0.5, y - 1, z - 1);
        } else if (y !== neighbourY) {
          edge.rotateY(Math.PI / 2);
          edge.translate(x - 1, Math.min(y, neighbourY) - 0.5, z - 1);
        } else {
          edge.rotateX(Math.PI / 2);
          edge.translate(x - 1, y - 1, Math.min(z, neighbourZ) - 0.5);
        }

        shapeGeometries.push(edge);
      }
    }

    filled.push(...newFilled);
  }

  const shapeGeometryCombined = mergeBufferGeometries(shapeGeometries);
  return new THREE.Mesh(shapeGeometryCombined, shapeMaterial);
}

function initShapes(scene: THREE.Scene, { config }: InitProps<SketchConfig>) {
  if (!config) throw new Error('???');

  const shapes = new THREE.Group();

  const scale = config.shapeSize / 2;
  const offset = config.shapeOffset;

  // TODO: undo perf
  // const toGenerate = 7;
  const toGenerate = 3;

  for (let x = -toGenerate; x <= toGenerate; x++) {
    for (let y = -toGenerate; y <= toGenerate; y++) {
      for (let z = -toGenerate; z <= toGenerate; z++) {
        const distToCenter = Math.sqrt(
          Math.pow(x, 2) + Math.pow(y, 2) + Math.pow(z, 2)
        );

        const offsetX = x * offset;
        const offsetY = y * offset;
        const offsetZ = z * offset;

        const shape = generateShape();
        shape.scale.set(scale, scale, scale);
        shape.position.set(offsetX, offsetY, offsetZ);
        shape.visible = distToCenter * offset < config.sphereRadius;
        shapes.add(shape);

        const aNormal = shape.geometry.attributes.normal;
        const aCenterArray = new Float32Array(aNormal.array.length);
        for (let i = 0; i < aNormal.count; i++) {
          aCenterArray[i * 3] = offsetX;
          aCenterArray[i * 3 + 1] = offsetY;
          aCenterArray[i * 3 + 2] = offsetZ;
        }
        const aCenter = new THREE.BufferAttribute(aCenterArray, 3);
        shape.geometry.setAttribute('aCenter', aCenter);

        shape.userData.unoffsetPosition = [x, y, z];
        shape.userData.distToCenter = distToCenter;
      }
    }
  }

  scene.add(shapes);

  const frame = (props: FrameProps<CanvasState, SketchConfig>) => {
    if (!props.config) throw new Error('???');

    if (props.hasChanged) {
      const scale = config.shapeSize / 2;
      const offset = config.shapeOffset;

      for (const shape of shapes.children) {
        shape.scale.set(scale, scale, scale);
        const [x, y, z] = shape.userData.unoffsetPosition;
        shape.position.set(x * offset, y * offset, z * offset);
      }
    }

    const highlighter = scene.getObjectByName('highlighter');
    if (!(highlighter instanceof THREE.Mesh)) throw new Error('???');

    shapeMaterial.uniforms.uHighlighterMatrixWorld.value =
      highlighter.matrixWorld;
  };

  return { frame };
}

function initHighlighter(scene: THREE.Scene, _props: InitProps<SketchConfig>) {
  const geometry = new THREE.PlaneGeometry(0.4, 1000);
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const highlighter = new THREE.Mesh(geometry, material);
  highlighter.name = 'highlighter';
  scene.add(highlighter);

  const frame = (props: FrameProps<CanvasState, SketchConfig>) => {
    const { config, timestamp, state } = props;

    const camera = scene.getObjectByProperty('isCamera', true);
    if (!camera || !config) throw new Error('???');
    highlighter.lookAt(camera.position);

    const noiseInFactor = config.highlighterNoiseInFactor / 1e3;
    const noiseOutFactor = config.highlighterNoiseOutFactor;
    const noise = state.simplex.noise2D(timestamp * noiseInFactor, 0);
    highlighter.rotateZ((Math.PI / 2) * (noise * noiseOutFactor + 1));
  };

  return { frame };
}

const init: InitFn<CanvasState, SketchConfig> = (props) => {
  if (!props.renderer) throw new Error('???');

  props.initControls(({ pane, config }) => {
    pane.addInput(config, 'rotationSpeed', { min: 0, max: 20 });
    pane.addInput(config, 'sphereRadius', { min: 2, max: 40 });
    pane.addInput(config, 'shapeOffset', { min: 0, max: 10 });
    pane.addInput(config, 'shapeSize', { min: 0.1, max: 10 });
    pane.addInput(config, 'highlighterNoiseInFactor', { min: 0, max: 0.5 });
    pane.addInput(config, 'highlighterNoiseOutFactor', { min: 0, max: 2 });
  });

  // TODO: Enable this and make sure none of the shapes are too nazi
  // random.setSeed('blabla');

  // We use the random module to seed the noise so that if we set the random
  // module's seed, it also seeds this module
  const simplex = new SimplexNoise(random.string());

  const scene = new THREE.Scene();

  const camera = initCamera(scene, props);
  const shapes = initShapes(scene, props);
  const highlighter = initHighlighter(scene, props);

  return { simplex, scene, camera, shapes, highlighter };
};

const frame: FrameFn<CanvasState, SketchConfig> = (props) => {
  const { renderer, config, state } = props;
  if (!renderer || !config) throw new Error('???');

  state.camera.frame(props);
  state.highlighter.frame(props);
  state.shapes.frame(props);

  renderer.render(state.scene, state.camera.camera);
};

export default toCanvasComponent<CanvasState, SketchConfig>(
  init,
  frame,
  sketchbookConfig
);
