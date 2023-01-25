import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';

import { extendMaterial } from '@/utils/three-extend-material';
import * as random from '@/utils/random';
import { toCanvasComponent } from '@/utils/renderers/vue';
import type {
  Config,
  InitFn,
  InitProps,
  FrameFn,
} from '@/utils/renderers/vanilla';

const glsl = String.raw;

interface CanvasState {
  composer: EffectComposer;
  scene: THREE.Scene;
  camera: ReturnType<typeof initCamera>;
  lighting: Awaited<ReturnType<typeof initLighting>>;
  rain: Awaited<ReturnType<typeof initRain>>;
  bloom: Awaited<ReturnType<typeof initBloom>>;
}

const sketchConfig = {
  lightColor: 0xe2af6c,
  lightBrightness: 1,
  exposure: 1.2,
  rain: {
    maxSpeed: 35,
    drops: 2500,
  },
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
  // TODO: why isn't decay working?
  pointLightLeft.distance = 10;
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
      // TODO should lightMaterial be 100% colour?
      lightMaterial.color.set(config.lightColor);
      pointLightLeft.color.set(config.lightColor);
      pointLightLeft.intensity = config.lightBrightness;
      pointLightRight.color.set(config.lightColor);
      pointLightRight.intensity = config.lightBrightness;
    }
  };

  return { frame };
}

const rainGeometry = new THREE.CylinderGeometry(0.01, 0.01, 0.5, 4);
const rainMaterial = extendMaterial(THREE.MeshLambertMaterial, {
  class: THREE.ShaderMaterial,

  vertexHeader: glsl`
    uniform float uCount;
    uniform float uTime;
    uniform float uMaxSpeed;

    attribute vec2 aRandom;

    mat4 translationMatrix(vec3 translation) {
      return mat4(
        1.0, 0.0, 0.0, 0.0,
        0.0, 1.0, 0.0, 0.0,
        0.0, 0.0, 1.0, 0.0,
        translation.x, translation.y, translation.z, 1.0
      );
    }
  `,

  vertex: {
    project_vertex: {
      '@mvPosition = instanceMatrix * mvPosition;': glsl`
        float initialPositionY = rand(fract(aRandom + 0.2)) * 20.0 + 6.0;

        float speed = uMaxSpeed + rand(fract(aRandom + 0.6)) * 5.0;
        initialPositionY -= uTime * speed;
        float fallNum = floor(initialPositionY / 20.0);
        float fallNumRand = fract(fallNum / 12345.678);
        initialPositionY = mod(initialPositionY, 20.0) + 6.0;

        vec3 initialPosition = vec3(
          rand(fract(aRandom + fallNumRand)) * 20.0 - 10.0,
          initialPositionY,
          rand(fract(aRandom + fallNumRand + 0.4)) * 20.0 - 10.0
        );

        // TODO: vary raindrop size (and terminal velocity accordingly)
        // TODO: vary raindrop angle, both overall and with simplex noise
        mvPosition = translationMatrix(initialPosition) * mvPosition;
      `,
    },
  },

  fragment: {
    lights_lambert_pars_fragment: {
      // This stops the raindrops from being brighter on one side than the other
      '@float dotNL =': glsl`float dotNL = 0.3;`,
    },
  },

  uniforms: {
    uCount: {
      value: 0,
      shared: true,
    },

    uTime: {
      value: 0,
      shared: true,
    },

    uMaxSpeed: {
      value: sketchConfig.rain.maxSpeed,
      shared: true,
    },
  },
});

function initRain(scene: THREE.Scene, { config }: InitProps<SketchConfig>) {
  if (!config) throw new Error('???');

  let rainObject = new THREE.InstancedMesh(
    rainGeometry,
    rainMaterial,
    config.rain.drops
  );

  const initRainInner = () => {
    const randNumsArray = new Float32Array(rainObject.count * 2);
    const randomNums = new THREE.InstancedBufferAttribute(randNumsArray, 2);
    rainGeometry.setAttribute('aRandom', randomNums);

    rainMaterial.uniforms.uCount.value = rainObject.count;

    for (let i = 0; i < randNumsArray.length; i++) {
      randNumsArray[i] = random.value();
    }

    scene.add(rainObject);
  };

  initRainInner();

  const frame: FrameFn<CanvasState, SketchConfig> = (props) => {
    if (props.hasChanged && props.config) {
      rainMaterial.uniforms.uMaxSpeed.value = props.config.rain.maxSpeed;

      if (props.config.rain.drops < rainObject.count) {
        rainObject.count = props.config.rain.drops;
      } else if (props.config.rain.drops > rainObject.count) {
        scene.remove(rainObject);
        rainObject = new THREE.InstancedMesh(
          rainGeometry,
          rainMaterial,
          config.rain.drops
        );
        initRainInner();
      }
    }

    rainMaterial.uniforms.uTime.value = props.timestamp / 1e3;
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
    pane.addInput(config, 'lightBrightness', { min: 0, max: 1 });
    pane.addInput(config, 'exposure', { min: 0, max: 2 });

    const rainFolder = pane.addFolder({ title: 'Rain' });
    rainFolder.addInput(config.rain, 'maxSpeed', { min: 6, max: 50 });
    rainFolder.addInput(config.rain, 'drops', { min: 100, max: 10000 });

    const bloomFolder = pane.addFolder({ title: 'Bloom' });

    bloomFolder.addInput(config.bloom, 'enabled');
    bloomFolder.addInput(config.bloom, 'threshold', { min: 0, max: 1 });
    bloomFolder.addInput(config.bloom, 'strength', { min: 0, max: 3 });
    bloomFolder.addInput(config.bloom, 'radius', { min: 0, max: 1 });
  });

  const scene = new THREE.Scene();

  const camera = initCamera(scene, props);
  const lighting = await initLighting(scene, props);
  const rain = initRain(scene, props);
  const bloom = initBloom(scene, props);

  return { composer: bloom.composer, scene, camera, lighting, rain, bloom };
};

const frame: FrameFn<CanvasState, SketchConfig> = (props) => {
  const { renderer, config, state } = props;
  if (!renderer || !config) throw new Error('???');

  state.lighting.frame(props);
  state.rain.frame(props);
  state.bloom.frame(props);

  state.composer.render();
};

export default toCanvasComponent<CanvasState, SketchConfig>(
  init,
  frame,
  sketchbookConfig
);
