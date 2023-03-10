import * as THREE from 'three';
import Matter from 'matter-js';

import type {
  SketchConfig,
  InitFn,
  InitProps,
  FrameFn,
} from '@/utils/renderers/vanilla';

export const meta = {
  name: 'Rolling sphere',
  date: '2023-01-03',
  tags: ['Three.js', '#genuary', '#genuary2023', '#genuary1'],
  codepen: 'https://codepen.io/callumacrae/full/QWBEmVR',
};

interface CanvasState {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  engine: Matter.Engine;
  frame: any;
}

const userConfig = {
  cameraYOffset: 20,
};
type UserConfig = typeof userConfig;

export const sketchConfig: Partial<SketchConfig<CanvasState, UserConfig>> = {
  type: 'threejs',
  // width: 720,
  // height: 720,
  capture: {
    enabled: false,
    duration: 6000,
    fps: 60,
    directory: 'rolling-sphere',
  },
  userConfig,
};

function initCamera(
  scene: THREE.Scene,
  { userConfig: config, width, height }: InitProps<CanvasState, UserConfig>
) {
  if (!config) throw new Error('???');
  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 100);
  camera.position.y = config.cameraYOffset;
  camera.position.z = 75;
  scene.add(camera);
  return camera;
}

export const init: InitFn<CanvasState, UserConfig> = (props) => {
  if (!props.renderer || !props.userConfig) throw new Error('???');

  props.renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();

  const camera = initCamera(scene, props);

  const pointLight = new THREE.PointLight(0xffffff, 0.15);
  pointLight.position.set(0, 30, 30);
  pointLight.castShadow = true;
  pointLight.shadow.radius = 10;
  pointLight.shadow.blurSamples = 16;
  scene.add(pointLight);

  // Duplicate the light so that the shadow is less intense
  const pointLightWithoutShadow = pointLight.clone();
  pointLightWithoutShadow.intensity = 0.1;
  pointLightWithoutShadow.castShadow = false;
  scene.add(pointLightWithoutShadow);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambientLight);

  const engine = Matter.Engine.create();
  engine.gravity.y = -0.8;

  const width = 40;
  const wallDepth = 12;
  const angle = 0.35;
  const xOffset = 15;
  const yOffset = 30;

  const wallGeometry = new THREE.BoxGeometry(width, 4, wallDepth);
  const wallMaterial = new THREE.MeshPhongMaterial({
    color: 0xf6f6f6,
    shininess: 0,
  });
  const initWall = (angle: number, x: number, y: number) => {
    const wallObject = new THREE.Mesh(wallGeometry, wallMaterial);
    wallObject.position.set(x, y, 0);
    wallObject.rotateZ(angle);
    wallObject.receiveShadow = true;
    wallObject.castShadow = true;
    const wallBody = Matter.Bodies.rectangle(x, y, width, 4, {
      angle,
      isStatic: true,
    });

    scene.add(wallObject);
    Matter.Composite.add(engine.world, [wallBody]);

    const frame = () => {
      if (wallBody.position.y > ballBody.position.y + yOffset * 3) {
        Matter.Body.translate(wallBody, Matter.Vector.create(0, yOffset * -6));
        wallObject.position.y = wallBody.position.y;
      }
    };

    return { frame };
  };

  const walls = [
    initWall(-angle, -xOffset, yOffset * 3),
    initWall(angle, xOffset, yOffset * 2),
    initWall(-angle, -xOffset, yOffset),
    initWall(angle, xOffset, 0),
    initWall(-angle, -xOffset, -yOffset),
    initWall(angle, xOffset, yOffset * -2),
    initWall(-angle, -xOffset, yOffset * -3),
  ];

  const backWallGeometry = new THREE.BoxGeometry(80, 1000, 2);
  const backWallMaterial = new THREE.MeshPhongMaterial({
    color: 0xf6f6f6,
    shininess: 0,
  });
  const backWallObject = new THREE.Mesh(backWallGeometry, backWallMaterial);
  backWallObject.receiveShadow = true;
  scene.add(backWallObject);

  const ballRadius = 7;
  const ballGeometry = new THREE.SphereGeometry(ballRadius);
  const ballMaterial = new THREE.MeshPhongMaterial({ color: 0xf6f6f6 });
  const ballObject = new THREE.Mesh(ballGeometry, ballMaterial);
  ballObject.castShadow = true;
  const ballBody = Matter.Bodies.circle(-15, 40, ballRadius, {
    friction: 0.0005,
    frictionStatic: 0,
    density: 0.01,
  });
  scene.add(ballObject);
  Matter.Composite.add(engine.world, [ballBody]);

  camera.lookAt(ballObject.position);

  const frame = (props: any) => {
    if (!props.config) throw new Error('???');
    ballObject.position.set(ballBody.position.x, ballBody.position.y, 0);
    ballObject.rotation.set(0, 0, ballBody.angle);

    // Thanks @nexii for this change!
    camera.position.y =
      camera.position.y * 0.95 +
      (ballBody.position.y + props.config.cameraYOffset) * 0.05;
    pointLight.position.y = camera.position.y - props.config.cameraYOffset + 30;
    pointLightWithoutShadow.position.y =
      camera.position.y - props.config.cameraYOffset + 30;
    backWallObject.position.y = ballBody.position.y;

    for (const wall of walls) {
      wall.frame();
    }
  };

  return { scene, camera, engine, frame };
};

export const frame: FrameFn<CanvasState, UserConfig> = (props) => {
  const { renderer, userConfig: config, state } = props;
  if (!renderer || !config) throw new Error('???');

  // TODO why can't i use delta??
  Matter.Engine.update(state.engine, 1000 / 60);

  state.frame(props);

  renderer.render(state.scene, state.camera);
};
