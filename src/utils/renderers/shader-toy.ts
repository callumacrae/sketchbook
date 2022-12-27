import * as THREE from 'three';

import { toCanvasComponent } from './vue';
import type { Config, InitFn, FrameFn } from './vanilla';

const uniforms = {
  iTime: { value: 0 },
  iResolution: { value: new THREE.Vector3() },
  iMouse: { value: new THREE.Vector3() },
};

interface CanvasState {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  uniforms: typeof uniforms;
}

const sketchConfig = {};
type SketchConfig = typeof sketchConfig;

const sketchbookConfig: Partial<Config<SketchConfig>> = {
  type: 'threejs',
  sketchConfig,
};

export function shaderToyComponent(glsl: string) {
  const init: InitFn<CanvasState, SketchConfig> = (props) => {
    // props.initControls(({ pane, config }) => {
    // });

    const scene = new THREE.Scene();

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
    scene.add(camera);

    const fragmentShader = `
    uniform vec3 iResolution;
    uniform float iTime;
    uniform vec3 iMouse;

    ${glsl}

    void main() {
      mainImage(gl_FragColor, gl_FragCoord.xy);
    }
  `;

    const plane = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({ fragmentShader, uniforms });
    scene.add(new THREE.Mesh(plane, material));

    return { scene, camera, uniforms };
  };

  const frame: FrameFn<CanvasState, SketchConfig> = (props) => {
    const { renderer, config, state, timestamp } = props;
    if (!renderer || !config) throw new Error('???');

    state.uniforms.iTime.value = timestamp / 1000;
    state.uniforms.iResolution.value.set(props.width, props.height, 1);

    renderer.render(state.scene, state.camera);
  };

  return toCanvasComponent<CanvasState, SketchConfig>(
    init,
    frame,
    sketchbookConfig
  );
}
