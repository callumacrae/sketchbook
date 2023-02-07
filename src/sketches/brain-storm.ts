import * as THREE from 'three';
import { Font, FontLoader } from 'three/examples/jsm/loaders/FontLoader';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry';
import { MeshLineGeometry, MeshLineMaterial } from 'meshline';
import * as random from '@/utils/random';
import * as math from '@/utils/maths';
import getMorseCoder from '@/utils/morse-code';

import figurePoints from './brain-storm-path.json';

import { toCanvasComponent } from '@/utils/renderers/vue';
import type {
  Config,
  InitFn,
  FrameFn,
  InitProps,
} from '@/utils/renderers/vanilla';

interface CanvasState {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  figure: Awaited<ReturnType<typeof initFigure>>;
  sphere: Awaited<ReturnType<typeof initSphere>>;
}

const sketchConfig = {
  startDelay: 1000,
  figure: {
    lineWidth: 1.5,
  },
  sphere: {
    radius: 200,
    textSize: 10,
    bands: 31,
    letterSpacing: 15,
    letterSpacingVar: 0.33,
    yMovement: { min: 0.0001, max: 0.002 },
  },
};
type SketchConfig = typeof sketchConfig;

const sketchbookConfig: Partial<Config<SketchConfig>> = {
  type: 'threejs',
  capture: {
    enabled: false,
    duration: 15000,
    fps: 24,
    directory: 'brain-storm',
  },
  width: 800,
  height: 800,
  pageBg: 'black',
  sketchConfig,
};

const morseCoder = getMorseCoder('... --- ...');
const getIsInverse = (t: number) =>
  t < sketchConfig.startDelay
    ? false
    : morseCoder.at((t - sketchConfig.startDelay) * 2.25);

function initCamera(
  scene: THREE.Scene,
  { width, height }: InitProps<CanvasState, SketchConfig>
) {
  const camera = new THREE.PerspectiveCamera(65, width / height, 0.1, 1000);
  camera.position.z = 450;
  scene.add(camera);
  return camera;
}

function initLighting(scene: THREE.Scene) {
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(0, 0, 10);
  scene.add(directionalLight);
}

function initFigure(
  scene: THREE.Scene,
  { config, width, height }: InitProps<CanvasState, SketchConfig>
) {
  if (!config) throw new Error('????');

  const figureGroup = new THREE.Group();

  const outlineGeom = new MeshLineGeometry();
  outlineGeom.setPoints(figurePoints as [number, number][]);
  const outlineMaterial = new MeshLineMaterial({
    color: 0xffffff,
    lineWidth: config.figure.lineWidth,
    resolution: new THREE.Vector2(width, height),
  });
  const outlineObject = new THREE.Mesh(outlineGeom, outlineMaterial);
  figureGroup.add(outlineObject);

  const inverseFillShape = new THREE.Shape();
  inverseFillShape.moveTo(-1000, -1000);
  inverseFillShape.lineTo(1000, -1000);
  inverseFillShape.lineTo(1000, 1000);
  inverseFillShape.lineTo(-1000, 1000);
  inverseFillShape.lineTo(-1000, -1000);

  const holePath = new THREE.Path();
  inverseFillShape.holes.push(holePath);

  const fillShape = new THREE.Shape();
  for (let i = 0; i < figurePoints.length; i++) {
    const point = figurePoints[i];
    if (i === 0) {
      fillShape.moveTo(point[0], point[1]);
      holePath.moveTo(point[0], point[1]);
    } else {
      fillShape.lineTo(point[0], point[1]);
      holePath.lineTo(point[0], point[1]);
    }
  }

  const fillGroup = new THREE.Group();
  const fillMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });

  const fillGeom = new THREE.ShapeGeometry(fillShape);
  const fillObject = new THREE.Mesh(fillGeom, fillMaterial);
  fillGroup.add(fillObject);

  const inverseFillGeom = new THREE.ShapeGeometry(inverseFillShape);
  const inverseFillObject = new THREE.Mesh(inverseFillGeom, fillMaterial);
  inverseFillObject.visible = false;
  fillGroup.add(inverseFillObject);

  // The translate ensures that it appears behind the outline
  fillGroup.translateZ(-0.1);

  figureGroup.add(fillGroup);

  scene.add(figureGroup);

  const frame: FrameFn<CanvasState, SketchConfig> = (props) => {
    if (props.hasChanged) {
      outlineMaterial.lineWidth = config.figure.lineWidth;
    }

    const isInverse = getIsInverse(props.timestamp);
    inverseFillObject.visible = isInverse;
    fillObject.visible = !isInverse;
  };

  return { frame };
}

async function initSphere(
  scene: THREE.Scene,
  { config }: InitProps<CanvasState, SketchConfig>
) {
  const loader = new FontLoader();
  const font = await new Promise<Font>((resolve) => {
    loader.load('/brain-storm/twitter-chirp.json', (font) => resolve(font));
  });

  const materials = [
    new THREE.MeshPhongMaterial({ color: 0xffffff, flatShading: true }), // front
    new THREE.MeshPhongMaterial({ color: 0xffffff }), // side
  ];
  const inverseMaterials = [
    new THREE.MeshPhongMaterial({ color: 0xff0000, flatShading: true }), // front
    new THREE.MeshPhongMaterial({ color: 0xff0000 }), // side
  ];

  function drawSphere() {
    if (!config) throw new Error('????');

    const characters = 'abcdefghijklmnopqrstuvwxyz'.split('');
    const characterGeometries = characters.map((character) => {
      const geometry = new TextGeometry(character, {
        font,
        size: config.sphere.textSize,
        height: 1,
        curveSegments: 12,
        bevelEnabled: false,
      });

      geometry.computeBoundingBox();
      const { boundingBox } = geometry;
      if (!boundingBox) throw new Error('??');
      const centerOffsetX = -0.5 * (boundingBox.max.x - boundingBox.min.x);
      // const centerOffsetY = -0.5 * (boundingBox.max.y - boundingBox.min.y);
      const centerOffsetY = config.sphere.textSize / -2;

      geometry.translate(centerOffsetX, centerOffsetY, 0);
      return geometry;
    });

    const sphereGroup = new THREE.Group();

    const bands = config.sphere.bands;
    for (let xIndex = 0; xIndex <= bands; xIndex++) {
      const bandGroup = new THREE.Group();
      bandGroup.userData.yVelocity =
        random.range(config.sphere.yMovement.min, config.sphere.yMovement.max) *
        random.pick([-1, 1]);

      const x = math.scale([-1, bands], [Math.PI / -2, Math.PI / 2], xIndex);
      const bandRadius = config.sphere.radius * Math.cos(x);
      const bandCircumference = 2 * Math.PI * bandRadius;

      const letterSpacing = config.sphere.letterSpacing;
      // We want to start with fewer letters on the bottom and top rings, but
      // not too few as the bands are moving
      const lettersOnBand = Math.floor(
        (bandCircumference + config.sphere.radius * 2 * Math.PI) /
          letterSpacing /
          2
      );
      for (let yIndex = 0; yIndex < lettersOnBand; yIndex++) {
        const { letterSpacingVar } = config.sphere;
        const y = math.scale(
          [0, lettersOnBand],
          [0, Math.PI * 2],
          yIndex + random.range(-letterSpacingVar, letterSpacingVar)
        );

        const textMesh = new THREE.Mesh(
          random.pick(characterGeometries),
          materials
        );

        textMesh.rotateY(y);
        textMesh.rotateX(x);
        textMesh.translateZ(-config.sphere.radius);
        bandGroup.add(textMesh);

        textMesh.userData.lastXRotation = x;
      }

      sphereGroup.add(bandGroup);
    }
    scene.add(sphereGroup);
    return sphereGroup;
  }

  let sphereGroup = drawSphere();

  const frame: FrameFn<CanvasState, SketchConfig> = ({
    hasChanged,
    timestamp,
    delta,
    config,
  }) => {
    if (!config) throw new Error('???');

    if (hasChanged) {
      sphereGroup.removeFromParent();
      sphereGroup = drawSphere();
    }

    const isInverse = getIsInverse(timestamp);
    for (const bandGroup of sphereGroup.children) {
      bandGroup.rotateY((bandGroup.userData.yVelocity / 16.6) * delta);

      for (const characterObj of bandGroup.children) {
        const position = new THREE.Vector3();
        position.setFromMatrixPosition(characterObj.matrixWorld);
        characterObj.visible = isInverse
          ? position.z < config.sphere.textSize / -2 - 2
          : true;

        characterObj.translateZ(config.sphere.radius);
        characterObj.rotateX(-characterObj.userData.lastXRotation);
        characterObj.userData.lastXRotation += delta * 0.00006;
        if (characterObj.userData.lastXRotation > Math.PI / 2) {
          characterObj.userData.lastXRotation -= Math.PI;
        }
        characterObj.rotateX(characterObj.userData.lastXRotation);
        characterObj.translateZ(-config.sphere.radius);

        const scale = math.scale(
          [(Math.PI / 8) * 3, Math.PI / 2],
          [1, 0],
          Math.abs(characterObj.userData.lastXRotation),
          true
        );
        characterObj.scale.set(scale, scale, scale);

        if (characterObj instanceof THREE.Mesh && characterObj.visible) {
          characterObj.material = isInverse ? inverseMaterials : materials;
        }
      }
    }
  };

  return { frame };
}

const init: InitFn<CanvasState, SketchConfig> = async (props) => {
  props.initControls(({ pane, config }) => {
    const figureFolder = pane.addFolder({ title: 'Figure' });
    figureFolder.addInput(config.figure, 'lineWidth', { min: 0, max: 5 });

    const sphereFolder = pane.addFolder({ title: 'Sphere' });
    sphereFolder.addInput(config.sphere, 'radius', { min: 150, max: 250 });
    sphereFolder.addInput(config.sphere, 'textSize', { min: 5, max: 50 });
    sphereFolder.addInput(config.sphere, 'bands', { min: 5, max: 51 });
    sphereFolder.addInput(config.sphere, 'letterSpacing', { min: 1, max: 100 });
    sphereFolder.addInput(config.sphere, 'letterSpacingVar', {
      min: 0,
      max: 1,
    });
    sphereFolder.addInput(config.sphere, 'yMovement', { min: 0, max: 0.01 });
  });

  const scene = new THREE.Scene();
  const camera = initCamera(scene, props);
  initLighting(scene);
  const sphere = await initSphere(scene, props);
  const figure = initFigure(scene, props);

  return {
    scene,
    camera,
    figure,
    sphere,
  };
};

const frame: FrameFn<CanvasState, SketchConfig> = (props) => {
  const { renderer, config, state } = props;
  if (!renderer || !config) throw new Error('???');

  state.figure.frame(props);
  state.sphere.frame(props);

  renderer.render(state.scene, state.camera);
};

export default toCanvasComponent<CanvasState, SketchConfig>(
  init,
  frame,
  sketchbookConfig
);
