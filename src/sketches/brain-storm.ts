import * as THREE from 'three';
import { Font, FontLoader } from 'three/examples/jsm/loaders/FontLoader';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry';
import { MeshLineGeometry, MeshLineMaterial } from 'meshline';
import * as random from '@/utils/random';
import * as math from '@/utils/maths';

// https://www.shutterstock.com/image-illustration/man-silhouette-floating-over-colored-space-1871484967
import figurePoints from './brain-storm-path.json';

import toCanvasComponent, {
  Config,
  InitFn,
  FrameFn,
  InitProps,
} from '../utils/to-canvas-component';

interface CanvasState {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  outlineMaterial: MeshLineMaterial;
  characterGroup: THREE.Group;
}

const sketchConfig = {
  lineWidth: 1.2,
};
type SketchConfig = typeof sketchConfig;

const sketchbookConfig: Partial<Config<SketchConfig>> = {
  type: 'threejs',
  sketchConfig,
};

function initCamera({ width, height }: InitProps<SketchConfig>) {
  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
  camera.position.z = 350;
  return camera;
}

function initLighting() {
  const lightingGroup = new THREE.Group();

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(0, 0, 10);
  lightingGroup.add(directionalLight);

  return { group: lightingGroup };
}

function initFigure({ config, width, height }: InitProps<SketchConfig>) {
  if (!config) throw new Error('????');

  const figureGroup = new THREE.Group();

  const outlineGeom = new MeshLineGeometry();
  outlineGeom.setPoints(figurePoints as [number, number][]);
  const fillShape = new THREE.Shape();
  for (let i = 0; i < figurePoints.length; i++) {
    const point = figurePoints[i];
    if (i === 0) {
      fillShape.moveTo(point[0], point[1]);
    } else {
      fillShape.lineTo(point[0], point[1]);
    }
  }
  const fillGeom = new THREE.ShapeGeometry(fillShape);
  // The translate ensures that it appears behind the outline
  fillGeom.translate(0, 0, -0.1);

  const outlineMaterial = new MeshLineMaterial({
    color: 0xffffff,
    lineWidth: config.lineWidth,
    resolution: new THREE.Vector2(width, height),
  });

  const fillMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });

  const outlineObject = new THREE.Mesh(outlineGeom, outlineMaterial);
  const fillObject = new THREE.Mesh(fillGeom, fillMaterial);

  figureGroup.add(outlineObject);
  figureGroup.add(fillObject);

  return { group: figureGroup, outlineMaterial };
}

async function initCharacters() {
  const characterGroup = new THREE.Group();

  const loader = new FontLoader();
  const font = await new Promise<Font>((resolve) => {
    loader.load('/brain-storm/helvetiker_regular.typeface.json', (font) =>
      resolve(font)
    );
  });

  const characterRadius = 200;

  const characters = 'abcdefghijklmnopqrstuvwxyz'.split('');
  const characterGeometries = characters.map((character) => {
    const size = 10;
    const geometry = new TextGeometry(character, {
      font,
      size,
      height: 1,
      curveSegments: 12,
      bevelEnabled: false,
    });

    geometry.computeBoundingBox();
    const { boundingBox } = geometry;
    if (!boundingBox) throw new Error('??');
    const centerOffsetX = -0.5 * (boundingBox.max.x - boundingBox.min.x);
    // const centerOffsetY = -0.5 * (boundingBox.max.y - boundingBox.min.y);
    const centerOffsetY = size / -2;

    geometry.translate(centerOffsetX, centerOffsetY, 0);
    return geometry;
  });

  const materials = [
    new THREE.MeshPhongMaterial({ color: 0xffffff, flatShading: true }), // front
    new THREE.MeshPhongMaterial({ color: 0xffffff }), // side
  ];

  const bands = 27;
  for (let xIndex = 0; xIndex < bands; xIndex++) {
    const bandGroup = new THREE.Group();

    const x = math.scale([-1, bands], [Math.PI / -2, Math.PI / 2], xIndex);
    const bandRadius = characterRadius * Math.cos(x);
    const bandCircumference = 2 * Math.PI * bandRadius;

    const letterSpacing = 15;

    const lettersOnBand = Math.floor(bandCircumference / letterSpacing);
    for (let yIndex = 0; yIndex < lettersOnBand; yIndex++) {
      const y = math.scale([0, lettersOnBand], [0, Math.PI * 2], yIndex);

      const textMesh = new THREE.Mesh(
        random.pick(characterGeometries),
        materials
      );

      textMesh.rotateY(y);
      textMesh.rotateX(x);
      textMesh.translateZ(-characterRadius);
      bandGroup.add(textMesh);
    }

    characterGroup.add(bandGroup);
  }

  return { group: characterGroup };
}

const init: InitFn<CanvasState, SketchConfig> = async (props) => {
  props.initControls(({ pane, config }) => {
    pane.addInput(config, 'lineWidth', { min: 0, max: 5 });
  });

  const scene = new THREE.Scene();

  const camera = initCamera(props);
  scene.add(camera);

  const lighting = initLighting();
  scene.add(lighting.group);

  const characters = await initCharacters();
  scene.add(characters.group);

  const figure = initFigure(props);
  scene.add(figure.group);

  return {
    scene,
    camera,
    outlineMaterial: figure.outlineMaterial,
    characterGroup: characters.group,
  };
};

const frame: FrameFn<CanvasState, SketchConfig> = ({
  renderer,
  config,
  state,
}) => {
  if (!renderer || !config) throw new Error('???');

  const { scene, camera, outlineMaterial, characterGroup } = state;

  outlineMaterial.lineWidth = config.lineWidth;

  const bandGroup = characterGroup.children[11];
  bandGroup.rotateY(0.002);

  renderer.render(scene, camera);
};

export default toCanvasComponent<CanvasState, SketchConfig>(
  init,
  frame,
  sketchbookConfig
);
