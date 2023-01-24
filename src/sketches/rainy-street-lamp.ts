import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';

import { toCanvasComponent } from '@/utils/renderers/vue';
import type {
  Config,
  InitFn,
  InitProps,
  FrameFn,
} from '@/utils/renderers/vanilla';

interface CanvasState {
  composer: EffectComposer;
  scene: THREE.Scene;
  camera: ReturnType<typeof initCamera>;
  lighting: Awaited<ReturnType<typeof initLighting>>;
  bloom: Awaited<ReturnType<typeof initBloom>>;
}

const sketchConfig = {
  lightColor: 0xcf9851,
  exposure: 1,
  bloom: {
    enabled: true,
    threshold: 0,
    strength: 2.0,
    radius: 0.33,
  },
};
type SketchConfig = typeof sketchConfig;

const sketchbookConfig: Partial<Config<SketchConfig>> = {
  type: 'threejs',
  sketchConfig,
};

function initCamera(
  scene: THREE.Scene,
  { renderer, width, height }: InitProps<SketchConfig>
) {
  if (!renderer) throw new Error('???');

  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 100);
  camera.position.y = 15;
  camera.position.x = -10;
  scene.add(camera);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target = new THREE.Vector3(0, 15, 0);
  controls.update();

  return { camera };
}

const lightGeometry = new THREE.SphereGeometry(1, 32, 32);
const lightMaterial = new THREE.MeshBasicMaterial({ color: 0xfefde8 });

async function initLighting(
  scene: THREE.Scene,
  { config }: InitProps<SketchConfig>
) {
  const loader = new GLTFLoader();
  const lampModel = await loader.loadAsync(
    '/rainy-street-lamp/street_light/scene.gltf'
  );

  const sceneLamps = lampModel.scene.getObjectByName('Object_3');
  if (sceneLamps) sceneLamps.visible = false;

  scene.add(lampModel.scene);

  const leftLamp = new THREE.Group();
  const leftLampObject = new THREE.Mesh(lightGeometry, lightMaterial);
  leftLamp.add(leftLampObject);
  const pointLightLeft = new THREE.PointLight(0xf6f5af, 1);
  leftLamp.add(pointLightLeft);
  leftLamp.position.set(0, 16.15, -2.73);
  scene.add(leftLamp);

  const rightLamp = new THREE.Group();
  const rightLampObject = new THREE.Mesh(lightGeometry, lightMaterial);
  rightLamp.add(rightLampObject);
  const pointLightRight = pointLightLeft.clone();
  rightLamp.add(pointLightRight);
  rightLamp.position.set(0, 16.15, 2.73);
  scene.add(rightLamp);

  const frame: FrameFn<CanvasState, SketchConfig> = (props) => {
    if (props.hasChanged && config) {
      leftLampObject.material.color.set(config.lightColor);
      pointLightLeft.color.set(config.lightColor);
      pointLightRight.color.set(config.lightColor);
    }
  };

  return { frame };
}

function initBloom(
  scene: THREE.Scene,
  { config, renderer, width, height }: InitProps<SketchConfig>
) {
  if (!renderer || !config) throw new Error('???');

  renderer.toneMapping = THREE.ReinhardToneMapping;
  renderer.toneMappingExposure = config.exposure;

  const camera = scene.getObjectByProperty('isCamera', true);
  if (!(camera instanceof THREE.PerspectiveCamera)) throw new Error('???');

  const renderScene = new RenderPass(scene, camera);
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(width, height),
    config.bloom.strength,
    config.bloom.radius,
    config.bloom.threshold
  );

  const composer = new EffectComposer(renderer);
  composer.addPass(renderScene);
  composer.addPass(bloomPass);

  const frame: FrameFn<CanvasState, SketchConfig> = (props) => {
    if (props.hasChanged && props.config) {
      renderer.toneMappingExposure = config.exposure;

      bloomPass.resolution.set(props.width, props.height);
      bloomPass.enabled = props.config.bloom.enabled;
      bloomPass.threshold = props.config.bloom.threshold;
      bloomPass.strength = props.config.bloom.strength;
      bloomPass.radius = props.config.bloom.radius;
    }
  };

  return { composer, frame };
}

const init: InitFn<CanvasState, SketchConfig> = async (props) => {
  props.initControls(({ pane, config }) => {
    pane.addInput(config, 'lightColor', { view: 'color' });
    pane.addInput(config, 'exposure', { min: 0, max: 2 });

    pane.addSeparator();

    pane.addInput(config.bloom, 'enabled');
    pane.addInput(config.bloom, 'threshold', { min: 0, max: 1 });
    pane.addInput(config.bloom, 'strength', { min: 0, max: 3 });
    pane.addInput(config.bloom, 'radius', { min: 0, max: 1 });
  });

  const scene = new THREE.Scene();

  const camera = initCamera(scene, props);
  const lighting = await initLighting(scene, props);
  const bloom = initBloom(scene, props);

  return { composer: bloom.composer, scene, camera, lighting, bloom };
};

const frame: FrameFn<CanvasState, SketchConfig> = (props) => {
  const { renderer, config, state } = props;
  if (!renderer || !config) throw new Error('???');

  state.lighting.frame(props);
  state.bloom.frame(props);

  state.composer.render();
};

export default toCanvasComponent<CanvasState, SketchConfig>(
  init,
  frame,
  sketchbookConfig
);
