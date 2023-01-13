import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
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
  mirrors: ReturnType<typeof initMirrors>;
}

const sketchConfig = {
  noiseXInFactor: 0.07,
  noiseYInFactor: 0.07,
  noiseAngleTimeInFactor: 0.1,
  noiseTiltTimeInFactor: 0.1,
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
    varying vec4 vPositionMirrorSpace[${mirrorsX * mirrorsY}];
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
        vMvPointLightPosition[i] = (projectionMatrix * modelViewMatrix * vec4(pointLights[i].position, 1.0)).xyz;
      }

      for (int i = 0; i < ${mirrorsX * mirrorsY}; i++) {
        vPositionMirrorSpace[i] = worldPosition * uMirrors[i].transformMatrix;
      }
    `,
  },

  fragment: {
    '#include <lights_fragment_begin>': glsl`
      for (int i = 0; i < ${mirrorsX * mirrorsY}; i++) {
        for (int j = 0; j < NUM_POINT_LIGHTS; j++) {
          vec4 reflectedLightPos = vec4(vMvPointLightPosition[j], 1.0)
            * uMirrors[i].transformMatrix;
          reflectedLightPos.z *= -1.0;
          vec4 positionMS = vPositionMirrorSpace[i];

          if (positionMS.z > 0.0) {
            float lambda = positionMS.z / (positionMS.z - reflectedLightPos.z);
            vec2 intersection = mix(positionMS.xy, reflectedLightPos.xy, lambda);

            if (length(intersection) < uMirrors[i].radius) {
              float lightDistance = distance(reflectedLightPos.xyz, positionMS.xyz);
              reflectedLight.directSpecular += pointLights[j].color
                * getDistanceAttenuation(lightDistance, 20.0, 1.8);
            }
          }
        }
      }
    `,
  },

  uniforms: {
    diffuse: {
      shared: true,
      value: new THREE.Color(0xaaaaaa),
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
}

function createMirror() {
  const mirror = new THREE.Group();

  // To ensure that angle is applied before tilt
  mirror.rotation.order = 'ZYX';

  const backGeometry = new THREE.SphereGeometry(1, 32, 32, 0, Math.PI);
  const backMaterial = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    shininess: 0,
  });
  const backObject = new THREE.Mesh(backGeometry, backMaterial);
  backObject.rotateX(Math.PI);

  const faceGeometry = new THREE.CircleGeometry(1, 32);
  const faceMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
  const faceObject = new THREE.Mesh(faceGeometry, faceMaterial);
  faceObject.rotation.y = Math.PI;
  faceObject.rotateX(Math.PI);

  mirror.add(backObject);
  mirror.add(faceObject);

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
    pane.addInput(config, 'noiseXInFactor', { min: 0, max: 1 });
    pane.addInput(config, 'noiseYInFactor', { min: 0, max: 1 });
    pane.addInput(config, 'noiseAngleTimeInFactor', { min: 0, max: 1 });
    pane.addInput(config, 'noiseTiltTimeInFactor', { min: 0, max: 1 });
  });

  const scene = new THREE.Scene();

  const camera = initCamera(scene, props);
  new OrbitControls(camera.camera, props.renderer.domElement);

  initLighting(scene);
  initFloor(scene);
  const mirrors = initMirrors(scene);

  return { simplex: new SimplexNoise('seed'), scene, camera, mirrors };
};

const frame: FrameFn<CanvasState, SketchConfig> = (props) => {
  const { renderer, config, state } = props;
  if (!renderer || !config) throw new Error('???');

  state.mirrors.frame(props);

  renderer.render(state.scene, state.camera.camera);
};

export default toCanvasComponent<CanvasState, SketchConfig>(
  init,
  frame,
  sketchbookConfig
);
