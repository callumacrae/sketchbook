import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass';

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
  light: {
    color: 0xe2af6c,
    brightness: 1,
    decay: 3,
  },
  toneMappingExposure: 1.2,
  toneMapping: THREE.ReinhardToneMapping,
  rain: {
    maxSpeed: 11,
    drops: 10000,
    width: 0.0015,
    lightFactor: 0.3,
  },
  wind: {
    direction: Math.PI * (14 / 8),
    windStrength: 4,
  },
  bloom: {
    enabled: true,
    threshold: 0,
    strength: 2,
    radius: 1,
  },
};
type SketchConfig = typeof sketchConfig;

const sketchbookConfig: Partial<Config<SketchConfig>> = {
  type: 'threejs',
  antialias: false,
  sketchConfig,
};

function initCamera(
  scene: THREE.Scene,
  { renderer, width, height }: InitProps<SketchConfig>
) {
  if (!renderer) throw new Error('???');

  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 100);
  camera.position.y = 4.6;
  camera.position.x = -3.5;
  scene.add(camera);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target = new THREE.Vector3(0, 4.6, 0);
  controls.update();

  return { camera };
}

const lightGeometry = new THREE.SphereGeometry(0.3, 32, 32);
const lightMaterial = new THREE.MeshStandardMaterial();

async function initLighting(
  scene: THREE.Scene,
  { config }: InitProps<SketchConfig>
) {
  const loader = new GLTFLoader();
  const lampModel = await loader.loadAsync(
    '/rainy-street-lamp/street_light/scene.gltf'
  );
  lampModel.scene.scale.set(0.305, 0.305, 0.305);

  const sceneLamps = lampModel.scene.getObjectByName('Object_3');
  if (sceneLamps) sceneLamps.visible = false;

  scene.add(lampModel.scene);

  const leftLamp = new THREE.Group();
  const leftLampObject = new THREE.Mesh(lightGeometry, lightMaterial);
  leftLamp.add(leftLampObject);
  const pointLightLeft = new THREE.PointLight(0xf6f5af, 1);
  leftLamp.add(pointLightLeft);
  leftLamp.position.set(0, 4.925, -0.82);
  scene.add(leftLamp);

  const rightLamp = new THREE.Group();
  const rightLampObject = new THREE.Mesh(lightGeometry, lightMaterial);
  rightLamp.add(rightLampObject);
  const pointLightRight = pointLightLeft.clone();
  rightLamp.add(pointLightRight);
  rightLamp.position.set(0, 4.925, 0.82);
  scene.add(rightLamp);

  const frame: FrameFn<CanvasState, SketchConfig> = (props) => {
    if (props.hasChanged && config) {
      lightMaterial.emissive = new THREE.Color(config.light.color);
      lightMaterial.emissiveIntensity = config.light.brightness;
      pointLightLeft.color.set(config.light.color);
      pointLightLeft.intensity = config.light.brightness;
      pointLightLeft.decay = config.light.decay;
      pointLightRight.color.set(config.light.color);
      pointLightRight.intensity = config.light.brightness;
      pointLightRight.decay = config.light.decay;
    }
  };

  return { frame };
}

const rainGeometry = new THREE.CylinderGeometry(1, 1, 1, 4);
let oldRainGeometryScale = 1;
const rainMaterial = extendMaterial(THREE.MeshLambertMaterial, {
  class: THREE.ShaderMaterial,

  vertexHeader: glsl`
    uniform float uCount;
    uniform float uTime;
    uniform float uMaxSpeed;
    uniform float uWindDirection;
    uniform float uWindStrength;
    uniform vec3 uPointLightPositions[NUM_POINT_LIGHTS];

    attribute vec2 aRandom;

    mat4 translationMatrix(vec3 translation) {
      return mat4(
        1.0, 0.0, 0.0, 0.0,
        0.0, 1.0, 0.0, 0.0,
        0.0, 0.0, 1.0, 0.0,
        translation.x, translation.y, translation.z, 1.0
      );
    }

    mat4 scaleMatrix(vec3 scale) {
      return mat4(
        scale.x, 0.0, 0.0, 0.0,
        0.0, scale.y, 0.0, 0.0,
        0.0, 0.0, scale.z, 0.0,
        0.0, 0.0, 0.0, 1.0
      );
    }

    mat4 rotationXMatrix(float angle) {
      float s = sin(angle);
      float c = cos(angle);

      return mat4(
        1.0, 0.0, 0.0, 0.0,
        0.0, c, s, 0.0,
        0.0, -s, c, 0.0,
        0.0, 0.0, 0.0, 1.0
      );
    }

    mat4 rotationYMatrix(float angle) {
      float s = sin(angle);
      float c = cos(angle);

      return mat4(
        c, 0.0, s, 0.0,
        0.0, 1.0, 0.0, 0.0,
        -s, 0.0, c, 0.0,
        0.0, 0.0, 0.0, 1.0
      );
    }
  `,

  vertex: {
    project_vertex: {
      '@mvPosition = instanceMatrix * mvPosition;': glsl`
        float initialPositionY = rand(fract(aRandom + 0.2)) * 6.0 + 1.83;

        float size = rand(fract(aRandom + 0.1)) * 0.4 + 0.6;

        float speed = uMaxSpeed * (rand(fract(aRandom + 0.6)) * 0.2 + 0.8) * (size / 2.0 + 0.5);
        initialPositionY -= uTime * speed;
        float fallNum = floor(initialPositionY / 6.0);
        float fallNumRand = fract(fallNum / 12345.678);
        initialPositionY = mod(initialPositionY, 6.0) + 1.83;

        int lightIndex = int(floor(rand(fract(aRandom + fallNumRand + 0.34)) * float(NUM_POINT_LIGHTS)));
        vec3 lightPosition = uPointLightPositions[lightIndex];
        float distFromLight = rand(fract(aRandom + fallNumRand));
        float angleAroundLight = rand(fract(aRandom + fallNumRand + 0.4)) * PI2;

        vec3 initialPosition = vec3(
          lightPosition.x + distFromLight * sin(angleAroundLight),
          initialPositionY,
          lightPosition.z + distFromLight * cos(angleAroundLight)
        );

        // The ideal shutter speed is twice the frame rate, but setting it to
        // the same as the frame rate looks better!
        float distPerFrame = speed / 60.0;

        // TODO: vary raindrop angle, both overall and with simplex noise
        // TODO: check for collisions with lamp

        mvPosition = translationMatrix(lightPosition)
          * rotationYMatrix(uWindDirection)
          * rotationXMatrix(PI / 16.0 * uWindStrength)
          * translationMatrix(-lightPosition)
          * translationMatrix(initialPosition)
          * scaleMatrix(vec3(size, distPerFrame, size))
          * mvPosition;
      `,
    },
  },

  fragmentHeader: glsl`
    uniform float uLightFactor;
  `,

  fragment: {
    lights_lambert_pars_fragment: {
      // This stops the raindrops from being brighter on one side than the other
      '@float dotNL =': glsl`float dotNL = uLightFactor;`,
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

    uLightFactor: {
      value: sketchConfig.rain.lightFactor,
      shared: true,
    },

    uWindDirection: {
      value: sketchConfig.wind.direction,
      share: true,
    },

    uWindStrength: {
      value: sketchConfig.wind.windStrength,
      share: true,
    },

    uPointLightPositions: {
      value: [],
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
      const scale = props.config.rain.width / oldRainGeometryScale;
      rainGeometry.scale(scale, 1, scale);
      oldRainGeometryScale = props.config.rain.width;
      rainMaterial.uniforms.uMaxSpeed.value = props.config.rain.maxSpeed;
      rainMaterial.uniforms.uLightFactor.value = props.config.rain.lightFactor;
      rainMaterial.uniforms.uWindDirection.value = props.config.wind.direction;
      rainMaterial.uniforms.uWindStrength.value =
        props.config.wind.windStrength;

      const pointLightPositions: THREE.Vector3[] = [];
      scene.traverseVisible((obj) => {
        if ('isPointLight' in obj) {
          const worldPosition = new THREE.Vector3();
          obj.getWorldPosition(worldPosition);
          pointLightPositions.push(worldPosition);
        }
      });
      rainMaterial.uniforms.uPointLightPositions.value = pointLightPositions;

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
  { config, renderer, width, height, dpr }: InitProps<SketchConfig>
) {
  if (!renderer || !config) throw new Error('???');

  renderer.physicallyCorrectLights = true;

  const camera = scene.getObjectByProperty('isCamera', true);
  if (!(camera instanceof THREE.PerspectiveCamera)) throw new Error('???');

  const renderPass = new RenderPass(scene, camera);
  const smaaPass = new SMAAPass(width * dpr, height * dpr);
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(width, height),
    config.bloom.strength,
    config.bloom.radius,
    config.bloom.threshold
  );

  const composer = new EffectComposer(renderer);
  composer.addPass(renderPass);
  composer.addPass(smaaPass);
  composer.addPass(bloomPass);

  const frame: FrameFn<CanvasState, SketchConfig> = (props) => {
    if (props.hasChanged && props.config) {
      renderer.toneMapping = config.toneMapping;
      renderer.toneMappingExposure = config.toneMappingExposure;

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
    const lightFolder = pane.addFolder({ title: 'Lights' });
    lightFolder.addInput(config.light, 'color', { view: 'color' });
    lightFolder.addInput(config.light, 'brightness', { min: 0, max: 1 });
    lightFolder.addInput(config.light, 'decay', { min: 0, max: 10 });

    const rainFolder = pane.addFolder({ title: 'Rain' });
    rainFolder.addInput(config.rain, 'maxSpeed', { min: 0.1, max: 20 });
    rainFolder.addInput(config.rain, 'drops', { min: 100, max: 100000 });
    rainFolder.addInput(config.rain, 'width', { min: 0.0005, max: 0.01 });
    rainFolder.addInput(config.rain, 'lightFactor', { min: 0.1, max: 1 });

    const windFolder = pane.addFolder({ title: 'Wind' });
    windFolder.addInput(config.wind, 'direction', { min: 0, max: Math.PI * 2 });
    windFolder.addInput(config.wind, 'windStrength', { min: 0, max: 7 });

    const rendererFolder = pane.addFolder({ title: 'Renderer' });
    rendererFolder.addInput(config, 'toneMapping', {
      options: {
        none: THREE.NoToneMapping,
        linear: THREE.LinearToneMapping,
        reinhard: THREE.ReinhardToneMapping,
        cineon: THREE.CineonToneMapping,
        'aces filmic': THREE.ACESFilmicToneMapping,
      },
    });
    rendererFolder.addInput(config, 'toneMappingExposure', { min: 0, max: 2 });

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
