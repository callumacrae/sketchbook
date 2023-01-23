import * as THREE from 'three';
import type { FolderApi, InputParams } from 'tweakpane';

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
  fragmentShader: string;
  material: THREE.ShaderMaterial;
  uniforms: typeof uniforms;
}

const parseValue = (value: string) => {
  if (['true', 'false'].includes(value)) return value === 'true';
  if (/^[\d.]+$/.test(value)) return Number(value);
  return value;
};

export function shaderToyComponent(glsl: string) {
  const sketchConfig: Record<string, any> = {};
  type SketchConfig = typeof sketchConfig;

  const sketchbookConfig: Partial<Config<SketchConfig>> = {
    type: 'threejs',
    sketchConfig,
  };

  const originalConfig: Record<
    string,
    { match: RegExpMatchArray; folder: string | null }
  > = {};
  const glslLines = glsl.split('\n');
  let currentFolder: string | null = null;

  for (const line of glslLines) {
    const folderMatch = line.match(/^\/\/\s*(.+)$/);
    if (folderMatch) {
      currentFolder = folderMatch[1];
      continue;
    }

    const defineMatch = line.match(
      /^#define\s+(\w+)\s+(.*?)(?:\s+\/\/\s+(.+))?$/
    );
    if (defineMatch) {
      originalConfig[defineMatch[1]] = {
        match: defineMatch,
        folder: currentFolder,
      };

      if (defineMatch[3] === 'no-config') {
        continue;
      }

      sketchConfig[defineMatch[1]] = parseValue(defineMatch[2]);
    }
  }

  const init: InitFn<CanvasState, SketchConfig> = (props) => {
    props.initControls(({ pane, config }) => {
      const folders: Record<string, FolderApi> = {};

      for (const key of Object.keys(config)) {
        const options: InputParams = {};

        const { match, folder } = originalConfig[key];

        if (folder && !folders[folder]) {
          folders[folder] = pane.addFolder({ title: folder });
        }

        if (typeof config[key] === 'number' && match[3]?.includes('-')) {
          const [min, max] = match[3].split(/\s*-\s*/).map(Number);
          options.min = min;
          options.max = max;
        } else if (match[3]?.includes(',') || match[3]?.includes(' or ')) {
          const inputOptions = match[3].split(/\s*,\s*|\s+or\s+/);
          options.options = Object.fromEntries(
            inputOptions.map((n) => {
              if (n.includes(':')) {
                const [key, value] = n.split(/\s*:\s*/g);
                return [key, parseValue(value)];
              }

              return [n, parseValue(n)];
            })
          );
        }

        (folder ? folders[folder] : pane).addInput(config, key, options);
      }
    });

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

    return { scene, camera, fragmentShader, material, uniforms };
  };

  const frame: FrameFn<CanvasState, SketchConfig> = (props) => {
    const { renderer, config, state, timestamp, hasChanged } = props;
    if (!renderer || !config) throw new Error('???');

    if (hasChanged) {
      const fragmentShader = state.material.fragmentShader.replace(
        /#define\s+(\w+)\s+(.*?)(?:\s+\/\/\s+(.+))?$/gm,
        (match, key) => {
          if (!(key in config)) return match;

          // This ensures floats are passed in with a decimal point
          if (/^\d+\.\d+$/.test(originalConfig[key].match[2])) {
            const formatted =
              config[key] % 1 ? config[key] : config[key].toFixed(1);
            return `#define ${key} ${formatted}`;
          }

          return `#define ${key} ${config[key]}`;
        }
      );

      state.material.fragmentShader = fragmentShader;
      state.material.needsUpdate = true;
    }

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
