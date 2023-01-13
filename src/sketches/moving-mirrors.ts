import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { Reflector } from 'three/examples/jsm/objects/Reflector';
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
  noiseAngleTimeInFactor: 0.1,
  noiseTiltTimeInFactor: 0.05,
  lightMoveRadius: 10,
  lightMoveSpeed: 0.5,
};
type SketchConfig = typeof sketchConfig;

// Unfortunately has to be done outside of the config for now
const mirrorsX = 3;
const mirrorsY = 3;

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
  const pointLight = new THREE.PointLight(0xffffff, 0.6);
  pointLight.position.set(0, 0, 17);
  scene.add(pointLight);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
  scene.add(ambientLight);

  const frame: FrameFn<CanvasState, SketchConfig> = (props) => {
    const { timestamp, config } = props;
    if (!config) throw new Error('???');

    const t = timestamp / 1e3;

    const x = Math.sin(t * config.lightMoveSpeed) * config.lightMoveRadius;
    const y = Math.cos(t * config.lightMoveSpeed) * config.lightMoveRadius;
    pointLight.position.set(x, y, pointLight.position.z);
  };

  return { frame };
}

const floorMaterial = extendMaterial(THREE.MeshPhongMaterial, {
  class: THREE.ShaderMaterial,

  header: glsl`
    #define USE_ENVMAP
    #define ENV_WORLDPOS

    struct Mirror {
      float radius;
      mat4 transformMatrix;
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

  // TODO: optimise by checking whether the mirror is even close by - skip if not
  fragment: {
    '#include <lights_fragment_begin>': glsl`
      for (int i = 0; i < ${mirrorsX * mirrorsY}; i++) {
        for (int j = 0; j < NUM_POINT_LIGHTS; j++) {
          vec4 reflectedLightPos = vec4(vMvPointLightPosition[j], 1.0)
            * uMirrors[i].transformMatrix;
          reflectedLightPos.z *= -1.0;
          vec4 positionMS = vec4(vWorldPosition, 1.0) * uMirrors[i].transformMatrix;

          if (positionMS.z > 0.0) {
            float lambda = positionMS.z / (positionMS.z - reflectedLightPos.z);
            vec2 intersection = mix(positionMS.xy, reflectedLightPos.xy, lambda);

            if (length(intersection) < uMirrors[i].radius) {
              float lightDistance = distance(reflectedLightPos.xyz, positionMS.xyz);
              reflectedLight.directSpecular += pointLights[j].color
                * getDistanceAttenuation(lightDistance, 25.0, 1.8);
            }
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
  mirror.add(faceObject);

  const actualMirror = new Reflector(new THREE.CircleGeometry(1, 32), {
    color: 0xffffff,
    textureWidth: 512,
    textureHeight: 512,
  });
  actualMirror.translateZ(0.051);
  // actualMirror.visible = false;
  mirror.add(actualMirror);

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
        0.75
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

        return { radius: 1, transformMatrix };
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
