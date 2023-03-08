import SimplexNoise from 'simplex-noise';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';

import { extendMaterial } from '@/utils/three-extend-material';
import * as random from '@/utils/random';
import type {
  Config,
  InitFn,
  InitProps,
  FrameFn,
} from '@/utils/renderers/vanilla';

export const meta = {
  name: 'Rainy street lamp',
  date: '2023-01-24',
  tags: ['Three.js', 'WebGL', 'GLSL'],
  favourite: true,
  codepen: 'https://codepen.io/callumacrae/full/LYBrjEP',
};

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
    brightness: 0.8,
    decay: 3,
  },
  toneMappingExposure: 1.2,
  toneMapping: THREE.ReinhardToneMapping,
  rain: {
    maxSpeed: 6,
    drops: 7000,
    width: 0.0015,
    lightFactor: 0.3,
  },
  wind: {
    direction: Math.PI * (14 / 8),
    windStrength: 2,
    // Variation 1 = random variation per individual raindrop
    strengthVariation1: 0.2,
    // Variation 2 = variation in overall wind speed applied to all raindrops
    strengthVariation2In: 0.25,
    strengthVariation2Out: 1,
    gustFrequency: 5,
    gustStrength: 5,
  },
  bloom: {
    enabled: true,
    threshold: 0,
    strength: 1.8,
    radius: 1,
  },
};
type SketchConfig = typeof sketchConfig;

const presets = {
  default: { ...sketchConfig.rain, ...sketchConfig.wind },
  'light rain': {
    ...sketchConfig.rain,
    maxSpeed: 4,
    drops: 4000,
    ...sketchConfig.wind,
    windStrength: 1.5,
    strengthVariation1: 0.3,
    strengthVariation2In: 0.2,
    strengthVariation2Out: 0.6,
    gustFrequency: 2.5,
    gustStrength: 1.52,
  },
  'snow?': {
    ...sketchConfig.rain,
    maxSpeed: 0.6,
    drops: 12000,
    width: 0.0025,
    ...sketchConfig.wind,
    windStrength: 1.8,
    strengthVariation1: 0.55,
    strengthVariation2In: 0.25,
    strengthVariation2Out: 0.55,
    gustStrength: 0,
  },
};

export const sketchbookConfig: Partial<Config<CanvasState, SketchConfig>> = {
  type: 'threejs',
  postprocessing: true,
  sketchConfig,
};

function initCamera(
  scene: THREE.Scene,
  { renderer, width, height }: InitProps<CanvasState, SketchConfig>
) {
  if (!renderer) throw new Error('???');

  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 100);
  camera.position.y = 4.6;
  camera.position.x = -2.8;
  scene.add(camera);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target = new THREE.Vector3(0, 4.6, 0);
  controls.update();

  return { camera };
}

const lightGeometry = new THREE.SphereGeometry(0.3, 16, 16);
const lightMaterial = new THREE.MeshStandardMaterial();

async function initLighting(
  scene: THREE.Scene,
  { config }: InitProps<CanvasState, SketchConfig>
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

const rainGeometry = new THREE.CylinderGeometry(1, 1, 1, 4, 1, true);
let oldRainGeometryScale = 1;
const rainMaterial = extendMaterial(THREE.MeshLambertMaterial, {
  class: THREE.ShaderMaterial,

  header: glsl`
    varying float vIsBelowLight;
  `,

  vertexHeader: glsl`
    uniform float uCount;
    uniform float uTime;
    uniform float uMaxSpeed;
    uniform float uWindDirection;
    uniform float uWindStrength;
    uniform float uWindStrengthVariation1;
    uniform float uGustFrequency;
    uniform float uGustStrength;
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

    // https://gist.github.com/patriciogonzalezvivo/670c22f3966e662d2f83
    vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
    float snoise(vec2 v){ const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439); vec2 i  = floor(v + dot(v, C.yy) ); vec2 x0 = v -   i + dot(i, C.xx); vec2 i1; i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0); vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1; i = mod(i, 289.0); vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 )); vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0); m = m*m ; m = m*m ; vec3 x = 2.0 * fract(p * C.www) - 1.0; vec3 h = abs(x) - 0.5; vec3 ox = floor(x + 0.5); vec3 a0 = x - ox; m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h ); vec3 g; g.x  = a0.x  * x0.x  + h.x  * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw; return 130.0 * dot(m, g); }
  `,

  vertex: {
    project_vertex: {
      '@mvPosition = instanceMatrix * mvPosition;': glsl`
        float positionBeforeWindY = rand(fract(aRandom + 0.2)) * 6.0 + 1.83;

        float size = rand(fract(aRandom + 0.1)) * 0.4 + 0.6;

        float speed = uMaxSpeed * (rand(fract(aRandom + 0.6)) * 0.4 + 0.6) * (size / 2.0 + 0.5);
        positionBeforeWindY -= uTime * speed;
        float fallNum = floor(positionBeforeWindY / 6.0);
        float fallNumRand = fract(fallNum / 12345.678);
        positionBeforeWindY = mod(positionBeforeWindY, 6.0) + 1.83;

        int lightIndex = int(floor(rand(fract(aRandom + fallNumRand + 0.34)) * float(NUM_POINT_LIGHTS)));
        vec3 lightPosition = uPointLightPositions[lightIndex];
        float distFromLight = rand(fract(aRandom + fallNumRand));
        float angleAroundLight = rand(fract(aRandom + fallNumRand + 0.4)) * PI2;

        vec3 positionBeforeWind = vec3(
          lightPosition.x + distFromLight * sin(angleAroundLight),
          positionBeforeWindY,
          lightPosition.z + distFromLight * cos(angleAroundLight)
        );

        float gustNoise = snoise(vec2(
          uTime * 0.2 * pow(uGustFrequency / 4.0, 0.5)
          + positionBeforeWind.z / 100.0 * speed
          + positionBeforeWindY / 100.0 * speed
        ));
        float gustStrength = smoothstep(1.0 - uGustFrequency * 0.15, 1.0, gustNoise) * uGustStrength;
        float windStrength = uWindStrength + gustStrength;
        float angle = PI / 2.5 * (1.0 - pow(1.0 - saturate(windStrength / 10.0), 3.0))
          + (rand(fract(aRandom + 0.87)) - 0.5) * uWindStrengthVariation1;

        // The ideal shutter speed is apparently twice the frame rate (120fps),
        // but setting it to the same as the frame rate looks better!
        float distPerFrame = (speed + windStrength) / 60.0;

        mvPosition = translationMatrix(lightPosition)
          * rotationYMatrix(uWindDirection) * rotationXMatrix(angle)
          * translationMatrix(-lightPosition)
          * translationMatrix(positionBeforeWind)
          * scaleMatrix(vec3(size, distPerFrame, size))
          * mvPosition;

        float r = 0.3; // TODO: probably shouldn't be hardcoded
        vIsBelowLight = positionBeforeWindY <= lightPosition.y
          && distance(positionBeforeWind.xz, lightPosition.xz) < r ? 1.0 : 0.0;
      `,
    },
  },

  fragmentHeader: glsl`
    uniform float uLightFactor;
  `,

  fragment: {
    lights_lambert_pars_fragment: {
      // This stops the raindrops from being brighter on one side than the other
      // and hides them if they've intersected
      '@float dotNL =': glsl`
        float dotNL = uLightFactor;
      `,
    },
    '?#include <output_fragment>': glsl`
      diffuseColor.a = 1.0 - vIsBelowLight;
    `,
  },

  material: {
    transparent: true,
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

    uWindStrengthVariation1: {
      value: sketchConfig.wind.strengthVariation1,
      share: true,
    },

    uGustFrequency: {
      value: sketchConfig.wind.gustFrequency,
      share: true,
    },

    uGustStrength: {
      value: sketchConfig.wind.gustStrength,
      share: true,
    },

    uPointLightPositions: {
      value: [],
      shared: true,
    },
  },
});

function initRain(
  scene: THREE.Scene,
  { config }: InitProps<CanvasState, SketchConfig>
) {
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

  const simplex = new SimplexNoise();

  const frame: FrameFn<CanvasState, SketchConfig> = (props) => {
    if (!props.config) throw new Error('???');

    if (props.hasChanged) {
      const scale = props.config.rain.width / oldRainGeometryScale;
      rainGeometry.scale(scale, 1, scale);
      oldRainGeometryScale = props.config.rain.width;
      rainMaterial.uniforms.uMaxSpeed.value = props.config.rain.maxSpeed;
      rainMaterial.uniforms.uLightFactor.value = props.config.rain.lightFactor;
      rainMaterial.uniforms.uWindDirection.value = props.config.wind.direction;
      rainMaterial.uniforms.uWindStrengthVariation1.value =
        props.config.wind.strengthVariation1;
      rainMaterial.uniforms.uGustFrequency.value =
        props.config.wind.gustFrequency;
      rainMaterial.uniforms.uGustStrength.value =
        props.config.wind.gustStrength;

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

    const strengthVariation2Noise = simplex.noise2D(
      (props.timestamp / 1e3) * props.config.wind.strengthVariation2In,
      0
    );
    // range is [1 - varOut / 2, 1 + varOut / 2]
    const strengthVariation2 =
      props.config.wind.strengthVariation2Out * (strengthVariation2Noise / 2) +
      1;
    rainMaterial.uniforms.uWindStrength.value =
      props.config.wind.windStrength * strengthVariation2;

    rainMaterial.uniforms.uTime.value = props.timestamp / 1e3;
  };

  return { frame };
}

function initBloom(
  scene: THREE.Scene,
  { config, renderer, width, height }: InitProps<CanvasState, SketchConfig>
) {
  if (!renderer || !config) throw new Error('???');

  renderer.physicallyCorrectLights = true;

  const camera = scene.getObjectByProperty('isCamera', true);
  if (!(camera instanceof THREE.PerspectiveCamera)) throw new Error('???');

  const renderPass = new RenderPass(scene, camera);
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(width, height),
    config.bloom.strength,
    config.bloom.radius,
    config.bloom.threshold
  );

  const composer = new EffectComposer(renderer);
  composer.addPass(renderPass);
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

export const init: InitFn<CanvasState, SketchConfig> = async (props) => {
  const controlsInitedAt = Date.now();
  props.initControls(({ pane, config, actualPane }) => {
    pane
      .addInput({ 'Load preset': 'default' }, 'Load preset', {
        options: Object.fromEntries(Object.keys(presets).map((p) => [p, p])),
      })
      .on('change', ({ value }) => {
        if (!(value in presets)) return;
        // Checking time so that we don't load preset on localStorage preset load
        if (Date.now() < controlsInitedAt + 1000) return;
        actualPane.importPreset(
          JSON.parse(JSON.stringify(presets[value as keyof typeof presets]))
        );
      });
    const lightFolder = pane.addFolder({ title: 'Lights' });
    lightFolder.addInput(config.light, 'color', { view: 'color' });
    lightFolder.addInput(config.light, 'brightness', { min: 0, max: 1 });
    lightFolder.addInput(config.light, 'decay', { min: 0, max: 10 });

    const rainFolder = pane.addFolder({ title: 'Rain' });
    rainFolder.addInput(config.rain, 'maxSpeed', { min: 0.1, max: 20 });
    rainFolder.addInput(config.rain, 'drops', { min: 100, max: 30000 });
    rainFolder.addInput(config.rain, 'width', { min: 0.0005, max: 0.01 });
    rainFolder.addInput(config.rain, 'lightFactor', { min: 0.1, max: 1 });

    const windFolder = pane.addFolder({ title: 'Wind' });
    windFolder.addInput(config.wind, 'direction', { min: 0, max: Math.PI * 2 });
    windFolder.addInput(config.wind, 'windStrength', { min: 0, max: 7 });
    windFolder.addInput(config.wind, 'strengthVariation1', { min: 0, max: 1 });
    windFolder.addInput(config.wind, 'strengthVariation2In', {
      min: 0,
      max: 0.5,
    });
    windFolder.addInput(config.wind, 'strengthVariation2Out', {
      min: 0,
      max: 2,
    });
    windFolder.addInput(config.wind, 'gustFrequency', { min: 0, max: 10 });
    windFolder.addInput(config.wind, 'gustStrength', { min: 0, max: 10 });

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

export const frame: FrameFn<CanvasState, SketchConfig> = (props) => {
  const { renderer, config, state } = props;
  if (!renderer || !config) throw new Error('???');

  state.lighting.frame(props);
  state.rain.frame(props);
  state.bloom.frame(props);

  state.composer.render();
};
