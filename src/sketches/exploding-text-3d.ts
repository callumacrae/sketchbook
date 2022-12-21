import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { extendMaterial } from '@/utils/three-extend-material';
import { easePolyInOut } from 'd3-ease';

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
  lighting: Awaited<ReturnType<typeof initLighting>>;
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
  camera.position.y = 300;
  scene.add(camera);
  return camera;
}

function initLighting(scene: THREE.Scene) {
  const pos = new THREE.Vector3(-150, 150, 100);

  const pointLight = new THREE.PointLight(0xffffff, 1);
  pointLight.position.set(pos.x, pos.y, pos.z);
  scene.add(pointLight);

  // const pointLightMarker = new THREE.Mesh(
  //   new THREE.SphereGeometry(5, 10, 10),
  //   new THREE.MeshBasicMaterial({ color: 0xff0000 })
  // );
  // pointLightMarker.position.set(pos.x, pos.y, pos.z);
  // scene.add(pointLightMarker);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
  scene.add(ambientLight);

  const easeFnZ = easePolyInOut.exponent(9);
  const easeFnX = easePolyInOut.exponent(2);

  const frame: FrameFn<CanvasState, SketchConfig> = ({ timestamp }) => {
    const tz = (timestamp / 2000) % 1;
    // pointLightMarker.position.setZ((-tz + easeFnZ(tz)) * -300 + 100);
    pointLight.position.setZ((-tz + easeFnZ(tz)) * -300 + 100);

    const tx = Math.abs(((timestamp / 2000) % 2) - 1);
    // pointLightMarker.position.setX((easeFnX(tx) * 2 - 1) * 150);
    pointLight.position.setX((easeFnX(tx) * 2 - 1) * 200);
  };

  return { frame };
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

  helloMesh.material = extendMaterial(new THREE.MeshPhongMaterial(), {
    class: THREE.ShaderMaterial,

    vertexHeader: glsl`
      uniform float uTime;
      attribute vec3 aWorldPosition;
      attribute vec3 aWorldNormal;

      float easeInOut(float x, float ease) {
        return x < 0.5 ?
          pow(2.0, ease - 1.0) * pow(x, ease) :
          1.0 - pow(-2.0 * x + 2.0, ease) / 2.0;
      }
    `,
    vertex: {
      '#include <beginnormal_vertex>': glsl`
        float timeWithOffset = uTime - aWorldPosition.x / 50.0;
        float mixVal = easeInOut(abs(mod(timeWithOffset, 2.0) - 1.0), 9.0);
        objectNormal = mix(objectNormal, aWorldNormal, mixVal);
      `,
      transformEnd: glsl`
        transformed = mix(transformed, aWorldPosition, mixVal);
        float modTime = mod(timeWithOffset, 1.0);
        transformed.y += (-modTime + easeInOut(modTime, 9.0)) * 3.0;
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
    helloMesh.material.uniforms.uTime.value = timestamp / 2000;
  };

  return { frame };
}

const init: InitFn<CanvasState, SketchConfig> = async (props) => {
  if (!props.renderer) throw new Error('???');

  // props.initControls(({ pane, config }) => {});

  const scene = new THREE.Scene();

  const camera = initCamera(scene, props);
  new OrbitControls(camera, props.renderer.domElement);

  const lighting = initLighting(scene);
  const letters = await initLetters(scene, props);

  return { scene, camera, lighting, letters };
};

const frame: FrameFn<CanvasState, SketchConfig> = (props) => {
  const { renderer, config, state } = props;
  if (!renderer || !config) throw new Error('???');

  state.lighting.frame(props);
  state.letters.frame(props);

  renderer.render(state.scene, state.camera);
};

export default toCanvasComponent<CanvasState, SketchConfig>(
  init,
  frame,
  sketchbookConfig
);
