import { Pane, TabPageApi } from 'tweakpane';
import * as EssentialsPlugin from '@tweakpane/plugin-essentials';
import * as THREE from 'three';
import type { FpsGraphBladeApi } from '@tweakpane/plugin-essentials/dist/types/fps-graph/api/fps-graph';

export interface Config<SketchConfig = undefined> {
  type: 'context2d' | 'threejs';
  showLoading: boolean;
  animate: boolean;
  capture?: {
    enabled: boolean;
    duration: number;
    fps?: number;
    directory: string;
  };
  width?: number;
  height?: number;
  useDpr?: boolean;
  pageBg?: string;
  resizeDelay: number;
  sketchConfig: SketchConfig;
}

export interface InitControlsProps<SketchConfig> {
  pane: TabPageApi;
  config: SketchConfig;
}

export interface InitProps<SketchConfig = undefined> {
  ctx: CanvasRenderingContext2D | null;
  renderer: THREE.WebGLRenderer | null;
  width: number;
  height: number;
  dpr: number;
  timestamp: number;
  config?: SketchConfig;
  initControls: (cb: (props: InitControlsProps<SketchConfig>) => void) => void;
}

export interface FrameProps<CanvasState, SketchConfig = undefined> {
  ctx: CanvasRenderingContext2D | null;
  renderer: THREE.WebGLRenderer | null;
  width: number;
  height: number;
  dpr: number;
  state: CanvasState;
  timestamp: number;
  delta: number;
  config?: SketchConfig;
  hasChanged: boolean;
}

export type InitFn<CanvasState, SketchConfig = undefined> = (
  props: InitProps<SketchConfig>
) => CanvasState | Promise<CanvasState>;
export type FrameFn<CanvasState, SketchConfig = undefined> = (
  props: FrameProps<CanvasState, SketchConfig>
) => Promise<CanvasState | void> | CanvasState | void;

export async function toVanillaCanvas<
  CanvasState = undefined,
  SketchConfig = undefined
>(
  canvasEl: HTMLCanvasElement | null,
  init: InitFn<CanvasState, SketchConfig>,
  frame: FrameFn<CanvasState, SketchConfig>,
  sketchbookConfigIn: Partial<Config<SketchConfig>> = {}
) {
  const sketchbookConfig: Config<SketchConfig> = Object.assign(
    {
      type: 'context2d',
      showLoading: false,
      animate: true,
      resizeDelay: 50,
      sketchConfig: {} as SketchConfig,
    },
    sketchbookConfigIn
  );

  const data = {
    width: 0,
    height: 0,
    dpr: 0,
    hasChanged: true,
    sketchbookConfig: sketchbookConfig,
    canvas: null as HTMLCanvasElement | null,
    ctx: null as CanvasRenderingContext2D | null,
    renderer: null as THREE.WebGLRenderer | null,
    resizeTimeout: undefined as ReturnType<typeof setTimeout> | undefined,
    previousFrameTime: 0,
    animationFrame: undefined as
      | ReturnType<typeof requestAnimationFrame>
      | undefined,
    pane: undefined as Pane | undefined,
    fpsGraph: undefined as FpsGraphBladeApi | undefined,
    canvasState: undefined as CanvasState | undefined,
  };

  if (!canvasEl) {
    throw new Error('No canvas');
  }

  const config = sketchbookConfig.sketchConfig as SketchConfig | undefined;
  // Store as a string as it has to be copied every time it's used anyway
  const initialConfig = JSON.stringify(config);

  if (sketchbookConfig.pageBg) {
    document.body.style.background = sketchbookConfig.pageBg;
  }

  if (sketchbookConfig.type === 'context2d') {
    data.ctx = canvasEl.getContext('2d');

    if (!data.ctx) {
      throw new Error('No canvas context');
    }
  } else {
    data.renderer = new THREE.WebGLRenderer({
      canvas: canvasEl,
      antialias: true,
    });
  }

  setSize();

  const initProps: InitProps<SketchConfig> = {
    ctx: data.ctx,
    renderer: data.renderer,
    width: data.width,
    height: data.height,
    dpr: data.dpr,
    timestamp: 0,
    config,
    initControls: (cb) => {
      if (!config) {
        return;
      }

      const pane = new Pane({
        title: 'Controls',
        expanded:
          !window.frameElement &&
          Math.min(window.innerWidth, window.innerHeight) > 600 &&
          localStorage.getItem(`closed-${location.pathname}`) !== 'true',
      });
      pane.registerPlugin(EssentialsPlugin);
      data.pane = pane;

      pane.on('fold', ({ expanded }) => {
        localStorage.setItem(`closed-${location.pathname}`, String(!expanded));
      });
      const presetName = `preset-${location.pathname}`;
      pane.on('change', () => {
        localStorage.setItem(presetName, JSON.stringify(pane.exportPreset()));
        data.hasChanged = true;
      });

      const tab = pane.addTab({
        pages: [{ title: 'Sketch config' }, { title: 'Performance' }],
      });

      data.fpsGraph = tab.pages[1].addBlade({
        view: 'fpsgraph',
        label: 'FPS',
        lineCount: 2,
      }) as FpsGraphBladeApi;

      if (data.renderer) {
        tab.pages[1].addMonitor(data.renderer.info.render, 'triangles');
        tab.pages[1].addMonitor(data.renderer.info.render, 'calls');
        tab.pages[1].addMonitor(data.renderer.info.memory, 'textures');
        tab.pages[1].addMonitor(data.renderer.info.memory, 'geometries');
      }

      cb({ pane: tab.pages[0], config });

      tab.pages[0].addButton({ title: 'Reset' }).on('click', () => {
        pane.importPreset(JSON.parse(initialConfig));
      });

      const preset = localStorage.getItem(presetName);
      if (preset) {
        try {
          pane.importPreset(JSON.parse(preset));
        } catch (err) {
          console.error('Failed to set from preset', err);
        }
      }
    },
  };

  if (sketchbookConfig.showLoading && !sketchbookConfig.capture?.enabled) {
    if (data.renderer) {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
      scene.add(camera);

      const ctx = document.createElement('canvas').getContext('2d');
      if (!ctx) throw new Error('???');
      ctx.canvas.width = data.width;
      ctx.canvas.height = data.height;
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

      ctx.font = '16px Roboto Mono, Source Code Pro, Menlo, Courier, monospace';
      ctx.fillStyle = 'white';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('loading!', data.width / 2, data.height / 2);

      const plane = new THREE.PlaneGeometry(2, 2);
      const texture = new THREE.CanvasTexture(ctx.canvas);
      const material = new THREE.MeshBasicMaterial({ map: texture });
      scene.add(new THREE.Mesh(plane, material));

      data.renderer.render(scene, camera);
    } else {
      throw new Error('loading not supported for this type yet');
    }

    // TODO: Why is the setTimeout required?
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        data.animationFrame = requestAnimationFrame(() => resolve());
      }, 50);
    });
  }

  const state = await init(initProps);
  if (state) {
    data.canvasState = state;
  }

  // https://macr.ae/article/canvas-to-gif
  const captureData = {
    frames: {} as Record<string, string>,
    frameDuration: 0,
    frameCount: 0,
    framesNameLength: 0,
    frameNumber: 0,
    directory: sketchbookConfig.capture?.directory,
  };
  if (sketchbookConfig.capture) {
    captureData.frameDuration = 1e3 / (sketchbookConfig.capture.fps || 24);
    captureData.frameCount = Math.round(
      sketchbookConfig.capture.duration / captureData.frameDuration
    );
    captureData.framesNameLength = Math.ceil(
      Math.log10(captureData.frameCount)
    );
  }

  callFrame(0);

  window.addEventListener('resize', handleResize);

  async function callFrame(timestamp: number) {
    if (data.fpsGraph) {
      data.fpsGraph.begin();
    }

    if (!sketchbookConfig.capture?.enabled) {
      data.animationFrame = requestAnimationFrame(callFrame);
    }

    const hasChanged = data.hasChanged || sketchbookConfig.animate;

    if (hasChanged) {
      const frameProps: FrameProps<CanvasState, SketchConfig> = {
        ctx: data.ctx,
        renderer: data.renderer,
        width: data.width,
        height: data.height,
        dpr: data.dpr,
        state: data.canvasState as CanvasState,
        timestamp,
        delta: timestamp - data.previousFrameTime,
        config: data.sketchbookConfig.sketchConfig as SketchConfig | undefined,
        // hasChanged can be used to see if the config has changed
        hasChanged: data.hasChanged,
      };

      const newState = await frame(frameProps);
      if (newState) {
        data.canvasState = newState;
      }

      data.hasChanged = false;
      data.previousFrameTime = timestamp;
    }

    if (sketchbookConfig.capture?.enabled && canvasEl) {
      const frameName = captureData.frameNumber
        .toString()
        .padStart(captureData.framesNameLength, '0');
      console.info(`Capturing frame ${frameName}`);
      captureData.frames[frameName] = canvasEl.toDataURL('image/png');

      if (timestamp > sketchbookConfig.capture.duration) {
        console.log(
          `Sending ${Object.keys(captureData.frames).length} frames to server`
        );
        fetch('http://localhost:3000/save-images', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(captureData),
        });
      } else {
        captureData.frameNumber++;
        const timestamp = captureData.frameNumber * captureData.frameDuration;
        callFrame(timestamp);
      }
    }

    if (data.fpsGraph) {
      data.fpsGraph.end();
    }
  }

  function handleResize() {
    if (data.resizeTimeout) {
      clearTimeout(data.resizeTimeout);
    }
    const resizeDelay = data.sketchbookConfig.resizeDelay;
    data.resizeTimeout = setTimeout(() => setSize(), resizeDelay);
  }

  function setSize() {
    if (!canvasEl) {
      throw new Error('No canvas');
    }

    const config = data.sketchbookConfig;

    const useDpr = config.useDpr ?? config.type === 'threejs' ? false : true;
    const dpr = useDpr ? window.devicePixelRatio : 1;
    data.width = (config?.width ?? window.innerWidth) * dpr;
    data.height = (config?.height ?? window.innerHeight) * dpr;
    data.dpr = dpr;
    canvasEl.width = data.width;
    canvasEl.height = data.height;
    canvasEl.style.width = `${data.width / dpr}px`;
    canvasEl.style.height = `${data.height / dpr}px`;

    console.log(data.width, canvasEl.width, canvasEl.style.width);

    canvasEl.classList.toggle(
      'custom-size',
      !!(config?.width && config?.height)
    );

    data.hasChanged = true;

    if (data.renderer) {
      data.renderer.setSize(data.width, data.height);
      data.renderer.setPixelRatio(dpr);
    }
    const canvasState = data.canvasState as any;
    const camera = canvasState?.camera?.camera || canvasState?.camera;
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.aspect = data.width / data.height;
      camera.updateProjectionMatrix();
    }
  }

  return {
    callFrame,
    teardown() {
      window.removeEventListener('resize', handleResize);

      if (data.animationFrame) {
        cancelAnimationFrame(data.animationFrame);
      }

      if (data.pane) {
        data.pane.dispose();
      }
    },
  };
}
