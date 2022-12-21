import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { extendMaterial } from '@/utils/three-extend-material';
import { easeCubic } from 'd3-ease';

import { toCanvasComponent } from '@/utils/renderers/vue';
import type {
  Config,
  InitFn,
  InitProps,
  FrameFn,
} from '@/utils/renderers/vanilla';

const glsl = String.raw;

interface CanvasState {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  letters: Awaited<ReturnType<typeof initLetters>>;
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
  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
  camera.position.z = 500;
  scene.add(camera);
  return camera;
}

function initLighting(scene: THREE.Scene) {
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(0, 0, 10);
  scene.add(directionalLight);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
}

/**
 * Converts geometry to non-indexed and orders the triangles based on their
 * x position for a more graceful transition.
 */
function initGeometry(geometry: THREE.BufferGeometry) {
  const g = geometry.toNonIndexed();

  const triangleCount = g.attributes.position.count / 3;
  type TriangleSort = { index: number; center?: [number, number, number] };
  const triangles = new Array<TriangleSort>(triangleCount);
  for (let i = 0; i < triangleCount; i++) {
    triangles[i] = { index: i };
  }

  const posAry = g.attributes.position.array;
  function getCenter(cache: TriangleSort) {
    if (!cache.center) {
      const i = cache.index;
      cache.center = [
        (posAry[i * 9] + posAry[i * 9 + 3] + posAry[i * 9 + 6]) / 3,
        (posAry[i * 9 + 1] + posAry[i * 9 + 4] + posAry[i * 9 + 7]) / 3,
        (posAry[i * 9 + 2] + posAry[i * 9 + 5] + posAry[i * 9 + 8]) / 3,
      ];
    }
    return cache.center;
  }

  triangles.sort((a, b) => {
    const aCenter = getCenter(a);
    const bCenter = getCenter(b);

    return aCenter[0] - bCenter[0];
  });

  const orderedPositions = new Float32Array(g.attributes.position.count * 3);
  const orderedNormals = new Float32Array(g.attributes.normal.count * 3);
  for (let i = 0; i < triangleCount; i++) {
    const fromI = triangles[i].index;

    for (let j = 0; j < 9; j++) {
      orderedPositions[i * 9 + j] = g.attributes.position.array[fromI * 9 + j];
      orderedNormals[i * 9 + j] = g.attributes.normal.array[fromI * 9 + j];
    }
  }

  g.attributes.position = new THREE.BufferAttribute(orderedPositions, 3);
  g.attributes.normal = new THREE.BufferAttribute(orderedNormals, 3);

  return g;
}

async function initLetters(
  scene: THREE.Scene,
  _props: InitProps<SketchConfig>
) {
  const loader = new GLTFLoader();

  const textScene = await loader.loadAsync('/exploding-text/hello-world.glb');

  const helloMesh = textScene.scene.getObjectByName('Hello_mesh');
  if (!(helloMesh instanceof THREE.Mesh)) throw new Error('???');
  helloMesh.material = new THREE.MeshPhongMaterial({ color: 0xffffff });
  helloMesh.rotateX(Math.PI);
  scene.add(helloMesh);

  const worldMesh = textScene.scene.getObjectByName('World_mesh');
  if (!(worldMesh instanceof THREE.Mesh)) throw new Error('???');

  const helloGeo = initGeometry(helloMesh.geometry);
  helloMesh.geometry = helloGeo;
  const worldGeo = initGeometry(worldMesh.geometry);
  worldGeo.translate(0.8, 0, 0);

  const aWorldPosition = new Float32Array(
    helloGeo.attributes.position.count * 3
  );
  for (let i = 0; i < aWorldPosition.length / 3; i++) {
    for (let j = 0; j < 3; j++) {
      aWorldPosition[i * 3 + j] =
        worldGeo.attributes.position.array[i * 3 + j] ??
        worldGeo.attributes.position.array[
          worldGeo.attributes.position.count * 3 - 3 + j
        ];
    }
  }
  const aWorldNormal = new Float32Array(helloGeo.attributes.normal.count * 3);
  for (let i = 0; i < aWorldNormal.length; i++) {
    aWorldNormal[i] = worldGeo.attributes.normal.array[i] ?? 0;
  }

  helloMesh.geometry.setAttribute(
    'aWorldPosition',
    new THREE.BufferAttribute(aWorldPosition, 3)
  );
  helloMesh.geometry.setAttribute(
    'aWorldNormal',
    new THREE.BufferAttribute(aWorldNormal, 3)
  );

  helloMesh.material = extendMaterial(new THREE.MeshStandardMaterial(), {
    class: THREE.ShaderMaterial,

    vertexHeader: glsl`
      uniform float uTime;
      attribute vec3 aWorldPosition;
      attribute vec3 aWorldNormal;
    `,
    vertex: {
      transformEnd: glsl`
        transformed = mix(transformed, aWorldPosition, uTime);
      `,
      '#include <beginnormal_vertex>': glsl`
        objectNormal = mix(objectNormal, aWorldNormal, uTime);
      `,
    },

    uniforms: {
      uTime: {
        shared: true,
        mixed: true,
        value: 0,
      },
    },
  });

  const frame: FrameFn<CanvasState, SketchConfig> = ({ timestamp }) => {
    helloMesh.material.uniforms.uTime.value = easeCubic(
      Math.abs(((timestamp / 1000) % 2) - 1)
    );
  };

  return { frame };
}

const init: InitFn<CanvasState, SketchConfig> = async (props) => {
  if (!props.renderer) throw new Error('???');

  // props.initControls(({ pane, config }) => {});

  const scene = new THREE.Scene();

  const camera = initCamera(scene, props);
  new OrbitControls(camera, props.renderer.domElement);

  initLighting(scene);
  const letters = await initLetters(scene, props);

  return { scene, camera, letters };
};

const frame: FrameFn<CanvasState, SketchConfig> = (props) => {
  const { renderer, config, state } = props;
  if (!renderer || !config) throw new Error('???');

  state.letters.frame(props);

  renderer.render(state.scene, state.camera);
};

export default toCanvasComponent<CanvasState, SketchConfig>(
  init,
  frame,
  sketchbookConfig
);
