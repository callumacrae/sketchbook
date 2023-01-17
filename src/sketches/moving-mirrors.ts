import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
// import { Reflector } from 'three/examples/jsm/objects/Reflector';
import SimplexNoise from 'simplex-noise';

import { extendMaterial } from '@/utils/three-extend-material';
import { toCanvasComponent } from '@/utils/renderers/vue';
import type {
  Config,
  InitFn,
  InitProps,
  FrameFn,
} from '@/utils/renderers/vanilla';

const glsl = String.raw;

interface CanvasState {
  simplex: SimplexNoise;
  scene: THREE.Scene;
  camera: ReturnType<typeof initCamera>;
  lighting: ReturnType<typeof initLighting>;
  mirrors: ReturnType<typeof initMirrors>;
}

const sketchConfig = {
  noiseXInFactor: 0.07,
  noiseYInFactor: 0.07,
  noiseAngleTimeInFactor: 0.05,
  noiseTiltTimeInFactor: 0.05,
  lightMoveRadius: 10,
  lightMoveSpeed: 0.5,
};
type SketchConfig = typeof sketchConfig;

// Unfortunately has to be done outside of the config for now
const mirrorsX = 5;
const mirrorsY = 5;

const sketchbookConfig: Partial<Config<SketchConfig>> = {
  type: 'threejs',
  sketchConfig,
};

function initCamera(
  scene: THREE.Scene,
  { width, height }: InitProps<SketchConfig>
) {
  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 100);
  camera.position.z = 17;
  scene.add(camera);

  return { camera };
}

function initLighting(scene: THREE.Scene) {
  const twoLights = true;

  const pointLight = new THREE.PointLight(twoLights ? 0xff0000 : 0xffffff, 0.8);
  pointLight.castShadow = true;
  pointLight.position.set(0, 0, 13);
  pointLight.shadow.mapSize.width = 1024;
  pointLight.shadow.mapSize.height = 1024;
  scene.add(pointLight);

  let pointLight2: THREE.PointLight | undefined;
  if (twoLights) {
    pointLight2 = new THREE.PointLight(0x0000ff, 1);
    pointLight2.castShadow = true;
    pointLight2.position.set(0, 0, 13);
    pointLight2.shadow.mapSize.width = 1024;
    pointLight2.shadow.mapSize.height = 1024;
    scene.add(pointLight2);
  }

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
  scene.add(ambientLight);

  const frame: FrameFn<CanvasState, SketchConfig> = (props) => {
    const { timestamp, config } = props;
    if (!config) throw new Error('???');

    const t = timestamp / 1e3;

    const x = Math.sin(t * config.lightMoveSpeed) * config.lightMoveRadius;
    const y = Math.cos(t * config.lightMoveSpeed) * config.lightMoveRadius;
    pointLight.position.set(x, y, pointLight.position.z);

    if (pointLight2) {
      pointLight2.position.set(-x, -y, pointLight.position.z);
    }
  };

  return { frame };
}

const floorMaterial = extendMaterial(THREE.MeshPhongMaterial, {
  class: THREE.ShaderMaterial,

  header: glsl`
    #define USE_ENVMAP
    #define ENV_WORLDPOS

    struct Mirror {
      vec3 center;
      float radius;
      mat4 transformMatrix;
      mat4 inverseTransformMatrix;
    };

    uniform Mirror uMirrors[${mirrorsX * mirrorsY}];

    varying vec3 vMvPointLightPosition[NUM_POINT_LIGHTS];
  `,

  vertexHeader: glsl`
    // TODO: any way of not having to copy this manually from lights_pars_begin?
    struct PointLight {
      vec3 position;
      vec3 color;
      float distance;
      float decay;
    };

    uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
  `,

  vertex: {
    '#include <worldpos_vertex>': glsl`
      for (int i = 0; i < NUM_POINT_LIGHTS; i++) {
        vMvPointLightPosition[i] = (inverse(modelViewMatrix) * vec4(pointLights[i].position, 1.0)).xyz;
        // I've definitely either messed up my maths or misunderstood something here…
        vMvPointLightPosition[i].xy = vMvPointLightPosition[i].yx;
        vMvPointLightPosition[i].y *= -1.0;
      }
    `,
  },

  fragment: {
    // MS = mirror space
    // SS = shadow space
    // NS = "normal" space (i.e. world space)
    '#include <lights_fragment_begin>': glsl`
      for (int i = 0; i < ${mirrorsX * mirrorsY}; i++) {
        vec4 positionMS = vec4(vWorldPosition, 1.0) * uMirrors[i].transformMatrix;
        if (positionMS.z <= 0.0) continue;

        // If the mirror isn't close by, no point calculating the intersection
        // as the light would be negligable anyway
        if (distance(vWorldPosition, uMirrors[i].center) > 10.0) continue;

        for (int j = 0; j < NUM_POINT_LIGHTS; j++) {
          vec4 reflectedLightPos = vec4(vMvPointLightPosition[j], 1.0)
            * uMirrors[i].transformMatrix;
          reflectedLightPos.z *= -1.0;
          vec4 reflectedLightPosNS = reflectedLightPos
            * uMirrors[i].inverseTransformMatrix;
          
          if (reflectedLightPosNS.z <= 0.0) continue;

          float lambda = positionMS.z / (positionMS.z - reflectedLightPos.z);
          vec2 intersection = mix(positionMS.xy, reflectedLightPos.xy, lambda);
          if (length(intersection) >= uMirrors[i].radius) continue;

          // Check for shadows from other mirrors
          // This is a float so that anti-aliasing can be added later
          float shadow = 0.0;
          for (int k = 0; k < ${mirrorsX * mirrorsY}; k++) {
            if (k == i) continue;
            if (distance(uMirrors[i].center, uMirrors[k].center) > 5.0) continue;

            vec4 shadowMirrorPosMS = vec4(uMirrors[k].center, 1.0)
              * uMirrors[i].transformMatrix;
            if (shadowMirrorPosMS.z < 0.0) continue;

            vec4 mirrorPosSS = vec4(uMirrors[i].center, 1.0) * uMirrors[k].transformMatrix;
            vec4 positionSS = vec4(vWorldPosition, 1.0) * uMirrors[k].transformMatrix;
            if (mirrorPosSS.z < 0.0 ? positionSS.z < 0.0 : positionSS.z > 0.0) continue;

            vec4 reflectedLightPosSS = reflectedLightPosNS * uMirrors[k].transformMatrix;

            float lambda2 = positionSS.z / (positionSS.z - reflectedLightPosSS.z);
            vec2 intersection2 = mix(positionSS.xy, reflectedLightPosSS.xy, lambda2);

            if (length(intersection2) < uMirrors[k].radius) {
              shadow = 1.0;
              break;
            }
          }

          if (shadow == 0.0) {
            float lightDistance = distance(reflectedLightPos.xyz, positionMS.xyz);
            float dotNL = saturate(dot(vec3(0.0, 0.0, 1.0), normalize(reflectedLightPosNS.xyz)));
            reflectedLight.directSpecular += pointLights[j].color * dotNL
              * getDistanceAttenuation(lightDistance, 29.0, 1.7);
          }
        }
      }
    `,
  },

  uniforms: {
    diffuse: {
      shared: true,
      value: new THREE.Color(0x999999),
    },

    uMirrors: {
      shared: true,
      value: [],
    },
  },
});

function initFloor(scene: THREE.Scene) {
  const floorGeometry = new THREE.PlaneGeometry(100, 100);
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.receiveShadow = true;
  floor.rotation.z = -Math.PI / 2;
  scene.add(floor);

  scene.background = new THREE.Color(0x999999);
}

const faceGeometry = new THREE.CylinderGeometry(1, 1, 0.1, 32);
const faceMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
const backMaterial = new THREE.MeshPhongMaterial({
  color: 0x666666,
  shininess: 0,
});
function createMirror() {
  const mirror = new THREE.Group();

  // To ensure that angle is applied before tilt
  mirror.rotation.order = 'ZYX';

  const faceObject = new THREE.Mesh(faceGeometry, [
    backMaterial,
    faceMaterial,
    backMaterial,
  ]);
  faceObject.translateZ(-0.05);
  faceObject.rotateX(Math.PI / 2);
  faceObject.castShadow = true;
  mirror.add(faceObject);

  // const actualMirror = new Reflector(new THREE.CircleGeometry(1, 32), {
  //   color: 0xffffff,
  //   textureWidth: 512,
  //   textureHeight: 512,
  // });
  // actualMirror.translateZ(0.051);
  // // actualMirror.visible = false;
  // mirror.add(actualMirror);

  return mirror;
}

function initMirrors(scene: THREE.Scene) {
  const mirrorsGroup = new THREE.Group();

  const spacingX = 2.5;
  const spacingY = 2.5;

  for (let x = 0; x < mirrorsX; x++) {
    for (let y = 0; y < mirrorsY; y++) {
      const mirror = createMirror();
      mirror.position.set(
        (x - mirrorsX / 2 + 0.5) * spacingX,
        (y - mirrorsY / 2 + 0.5) * spacingY,
        // The z position can't be reduced due to a bug which means the floor
        // can be lit from below (TODO)
        0.5
      );

      mirrorsGroup.add(mirror);
    }
  }

  scene.add(mirrorsGroup);

  const frame: FrameFn<CanvasState, SketchConfig> = (props) => {
    const { timestamp, state, config } = props;
    if (!config) throw new Error('???');

    const t = timestamp / 1e3;

    floorMaterial.uniforms.uMirrors.value = mirrorsGroup.children
      .map((mirror) => {
        if (!(mirror instanceof THREE.Group)) return;

        const { x, y } = mirror.position;

        const angleNoise = state.simplex.noise3D(
          x * config.noiseXInFactor,
          y * config.noiseYInFactor,
          t * config.noiseAngleTimeInFactor
        );
        mirror.rotation.z = angleNoise * Math.PI;

        const tiltNoise = state.simplex.noise3D(
          x * config.noiseXInFactor,
          y * config.noiseYInFactor,
          t * config.noiseTiltTimeInFactor + 100
        );
        mirror.rotation.x = (tiltNoise * Math.PI) / 2;

        const transformMatrix = new THREE.Matrix4()
          .setPosition(mirror.position.clone().negate())
          .transpose()
          .multiply(new THREE.Matrix4().makeRotationFromEuler(mirror.rotation));

        return {
          center: mirror.position,
          radius: 1,
          transformMatrix,
          inverseTransformMatrix: transformMatrix.clone().invert(),
        };
      })
      .filter(Boolean);
  };

  return { frame };
}

const init: InitFn<CanvasState, SketchConfig> = (props) => {
  if (!props.renderer) throw new Error('???');

  props.initControls(({ pane, config }) => {
    const mirrorFolder = pane.addFolder({ title: 'Mirrors' });
    mirrorFolder.addInput(config, 'noiseXInFactor', { min: 0, max: 1 });
    mirrorFolder.addInput(config, 'noiseYInFactor', { min: 0, max: 1 });
    mirrorFolder.addInput(config, 'noiseAngleTimeInFactor', { min: 0, max: 1 });
    mirrorFolder.addInput(config, 'noiseTiltTimeInFactor', { min: 0, max: 1 });

    const lightFolder = pane.addFolder({ title: 'Light' });
    lightFolder.addInput(config, 'lightMoveSpeed', { min: 0, max: 2 });
    lightFolder.addInput(config, 'lightMoveRadius', { min: 0, max: 20 });
  });

  props.renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();

  const camera = initCamera(scene, props);
  new OrbitControls(camera.camera, props.renderer.domElement);

  const lighting = initLighting(scene);
  initFloor(scene);
  const mirrors = initMirrors(scene);

  return {
    simplex: new SimplexNoise('seed'),
    scene,
    camera,
    lighting,
    mirrors,
  };
};

const frame: FrameFn<CanvasState, SketchConfig> = (props) => {
  const { renderer, config, state } = props;
  if (!renderer || !config) throw new Error('???');

  state.lighting.frame(props);
  state.mirrors.frame(props);

  renderer.render(state.scene, state.camera.camera);
};

export default toCanvasComponent<CanvasState, SketchConfig>(
  init,
  frame,
  sketchbookConfig
);
