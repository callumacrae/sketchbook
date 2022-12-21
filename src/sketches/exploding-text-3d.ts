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

function ease(num: number) {
  return easeCubic(Math.abs((num % 2) - 1));
}

async function initLetters(
  scene: THREE.Scene,
  _props: InitProps<SketchConfig>
) {
  const loader = new GLTFLoader();

  const textScene = await loader.loadAsync('/exploding-text/hello-world.glb');
  console.log(textScene);

  const helloMesh = textScene.scene.getObjectByName('Hello_mesh');
  if (!(helloMesh instanceof THREE.Mesh)) throw new Error('???');
  helloMesh.material = new THREE.MeshPhongMaterial({ color: 0xffffff });
  helloMesh.rotateX(Math.PI);
  scene.add(helloMesh);

  const worldMesh = textScene.scene.getObjectByName('World_mesh');
  if (!(worldMesh instanceof THREE.Mesh)) throw new Error('???');

  const helloGeo = (helloMesh.geometry as THREE.BufferGeometry).toNonIndexed();
  helloMesh.geometry = helloGeo;
  const worldGeo = (worldMesh.geometry as THREE.BufferGeometry).toNonIndexed();
  worldGeo.translate(0.8, 0, 0);

  const aWorldPosition = new Float32Array(
    helloGeo.attributes.position.count * 3
  );
  for (let i = 0; i < aWorldPosition.length; i++) {
    aWorldPosition[i] = worldGeo.attributes.position.array[i] ?? 0;
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
    helloMesh.material.uniforms.uTime.value = ease(timestamp / 1000);
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
