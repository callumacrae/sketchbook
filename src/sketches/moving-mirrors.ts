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
    transformEnd: glsl`
      #pragma unroll_loop_start
      for (int i = 0; i < NUM_POINT_LIGHTS; i++) {
        vMvPointLightPosition[i] = (projectionMatrix * modelViewMatrix * vec4(pointLights[i].position, 1.0)).xyz;
      }
      #pragma unroll_loop_end
    `,
  },

  fragmentHeader: glsl`
    struct Mirror {
      vec3 center;
      vec3 angle;
      float radius;
    };

    uniform Mirror uMirrors[${mirrorsX * mirrorsY}];

    mat4 translateMatrix(vec3 v) {
      return mat4(
        1.0, 0.0, 0.0, v.x,
        0.0, 1.0, 0.0, v.y,
        0.0, 0.0, 1.0, v.z,
        0.0, 0.0, 0.0, 1.0
      );
    }

    mat4 rotationXMatrix(float angle) {
      return mat4(
        1.0, 0.0, 0.0, 0.0,
        0.0, cos(angle), -sin(angle), 0.0,
        0.0, sin(angle), cos(angle), 0.0,
        0.0, 0.0, 0.0, 1.0
      );
    }

    mat4 rotationZMatrix(float angle) {
      return mat4(
        cos(angle), -sin(angle), 0.0, 0.0,
        sin(angle), cos(angle), 0.0, 0.0,
        0.0, 0.0, 1.0, 0.0,
        0.0, 0.0, 0.0, 1.0
      );
    }

    mat4 scaleZMatrix(float scale) {
      return mat4(
        1.0, 0.0, 0.0, 0.0,
        0.0, 1.0, 0.0, 0.0,
        0.0, 0.0, scale, 0.0,
        0.0, 0.0, 0.0, 1.0
      );
    }
  `,

  fragment: {
    '#include <lights_fragment_begin>': glsl`
      for (int i = 0; i < ${mirrorsX * mirrorsY}; i++) {
        Mirror mirror = uMirrors[i];
        mat4 mirrorTransform = translateMatrix(-mirror.center)
          * rotationZMatrix(-mirror.angle.z)* rotationXMatrix(-mirror.angle.x) ;
        
        PointLight pointLightReflection;
        IncidentLight directLightReflection;

        for (int j = 0; j < NUM_POINT_LIGHTS; j++) {
          pointLightReflection = pointLights[j];

          vec3 lightPos = vMvPointLightPosition[j];

          vec4 lightPosMirrorSpace = vec4(lightPos, 1.0) * mirrorTransform;
          vec4 reflectedLightPos = lightPosMirrorSpace * scaleZMatrix(-1.0);
          vec4 positionMirrorSpace = vec4(vWorldPosition, 1.0) * mirrorTransform;

          if (positionMirrorSpace.z > 0.0) {
            float lambda = positionMirrorSpace.z / (positionMirrorSpace.z - reflectedLightPos.z);
            vec3 intersection = mix(positionMirrorSpace.xyz, reflectedLightPos.xyz, lambda);

            if (sqrt(pow(intersection.x, 2.0) + pow(intersection.y, 2.0)) < mirror.radius) {
              float lightDistance = distance(reflectedLightPos.xyz, positionMirrorSpace.xyz);
              directLightReflection.color = pointLightReflection.color;
              directLightReflection.color *= getDistanceAttenuation(lightDistance, 20.0, 1.8);
              reflectedLight.directSpecular += directLightReflection.color;
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
      value: [
        { radius: 1, center: new THREE.Vector3(), angle: new THREE.Vector3() },
      ],
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

        return {
          radius: 1,
          center: mirror.position,
          angle: new THREE.Vector3(
            mirror.rotation.x,
            mirror.rotation.y,
            mirror.rotation.z
          ),
        };
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
