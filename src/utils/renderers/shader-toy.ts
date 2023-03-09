import * as THREE from 'three';
import type { FolderApi, InputParams } from 'tweakpane';
import type { Component } from 'vue';

import parseSketchMeta from '../sketch-parsing';
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
  material: THREE.ShaderMaterial;
  uniforms: typeof uniforms;
}

const parseValue = (value: string) => {
  if (['true', 'false'].includes(value)) return value === 'true';
  if (/^[\d.]+$/.test(value)) return Number(value);
  return value;
};

export function shaderToyComponent(
  glsl: string,
  filePath: string,
  SketchLinks: Component
) {
  const sketchConfig: Record<string, any> = {};
  type SketchConfig = typeof sketchConfig;

  const sketchbookConfig: Partial<Config<CanvasState, SketchConfig>> = {
    type: 'threejs',
    capture: {
      enabled: false,
      duration: 15000,
      fps: 24,
    },
    sketchConfig,
  };

  const meta = parseSketchMeta(glsl, filePath);
  if (meta?.config) {
    try {
      // yolo
      const extraConfig = eval(`(${meta.config})`);
      Object.assign(sketchbookConfig, extraConfig);
    } catch (err) {
      console.error('config for this sketch seems to be broken', err);
    }
  }

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

  const wrapShaderText = (glsl: string) => `
    uniform vec3 iResolution;
    uniform float iTime;
    uniform vec4 iMouse;

    ${glsl}

    void main() {
      mainImage(gl_FragColor, gl_FragCoord.xy);
    }
  `;

  const init: InitFn<CanvasState, SketchConfig> = (props) => {
    if (!props.renderer) throw new Error('???');

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

    const fragmentShader = wrapShaderText(glsl);
    const plane = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({ fragmentShader, uniforms });
    scene.add(new THREE.Mesh(plane, material));

    const mouse = new THREE.Vector4();
    props.addEvent('mousemove', ({ event }) => {
      if (event.buttons !== 1) return;
      mouse.x = event.clientX;
      mouse.y = window.innerHeight - event.clientY;
    });
    props.addEvent('mousedown', ({ event }) => {
      mouse.z = event.clientX;
      mouse.w = window.innerHeight - event.clientY;
    });
    props.addEvent('mouseup', () => {
      mouse.z = 0;
      mouse.w = 0;
    });
    props.addEvent('touchmove', ({ event }) => {
      mouse.x = event.touches[0].pageX;
      mouse.y = window.innerHeight - event.touches[0].pageY;
    });
    props.addEvent('touchstart', ({ event }) => {
      mouse.z = event.touches[0].pageX;
      mouse.w = window.innerHeight - event.touches[0].pageY;
    });
    props.addEvent('touchend', () => {
      // Got these weird values from shadertoy :shrug:
      mouse.z = -321;
      mouse.w = -310;
    });
    material.uniforms.iMouse.value = mouse;

    return { scene, camera, material, uniforms };
  };

  const frame: FrameFn<CanvasState, SketchConfig> = (props) => {
    const { renderer, config, state, timestamp, hasChanged } = props;
    if (!renderer || !config) throw new Error('???');

    const newGlsl: string = props.isPreview
      ? ''
      : (window as any).__sketch_glsl;
    if (hasChanged || newGlsl) {
      const fragmentShader = (
        newGlsl ? wrapShaderText(newGlsl) : state.material.fragmentShader
      ).replace(
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
      (window as any).__sketch_glsl = '';

      state.material.fragmentShader = fragmentShader;
      state.material.needsUpdate = true;
    }

    state.uniforms.iTime.value = timestamp / 1000;
    state.uniforms.iResolution.value.set(
      props.width * props.dpr,
      props.height * props.dpr,
      1
    );

    renderer.render(state.scene, state.camera);
  };

  return toCanvasComponent<CanvasState, SketchConfig>(
    init,
    frame,
    sketchbookConfig,
    { meta, component: SketchLinks }
  );
}
