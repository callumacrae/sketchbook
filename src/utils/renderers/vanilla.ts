import { Pane, TabPageApi } from 'tweakpane';
import * as EssentialsPlugin from '@tweakpane/plugin-essentials';
import * as THREE from 'three';
import type { FpsGraphBladeApi } from '@tweakpane/plugin-essentials/dist/types/fps-graph/api/fps-graph';
import writeScreen from '../canvas/written-screen';

type Type = 'context2d' | 'webgl' | 'threejs';

export interface Config<SketchConfig = undefined> {
  type: Type;
  xr?:
    | { enabled: false; [key: string]: any }
    | {
        enabled: true;
        permissionsButton: (renderer: THREE.WebGLRenderer) => HTMLElement;
      };
  showLoading: boolean;
  animate: boolean;
  capture?: {
    enabled: boolean;
    duration: number;
    fps?: number;
    directory?: string;
  };
  width?: number;
  height?: number;
  postprocessing?: boolean;
  pageBg?: string;
  resizeDelay: number;
  sketchConfig: SketchConfig;
}

export interface InitControlsProps<SketchConfig> {
  pane: TabPageApi;
  config: SketchConfig;
  actualPane: Pane;
}

export interface InitProps<CanvasState, SketchConfig = undefined> {
  ctx: CanvasRenderingContext2D | null;
  gl: WebGLRenderingContext | null;
  renderer: THREE.WebGLRenderer | null;
  width: number;
  height: number;
  dpr: number;
  timestamp: number;
  config: SketchConfig;
  initControls(cb?: (props: InitControlsProps<SketchConfig>) => void): void;
  addEvent<K extends keyof HTMLElementEventMap>(
    type: K,
    cb: (
      props: EventProps<CanvasState, SketchConfig, HTMLElementEventMap[K]>
    ) => boolean | void
  ): void;
  testSupport(cb: () => true | string): void;
}
export interface InitPropsWebgl<CanvasState, SketchConfig = undefined>
  extends InitProps<CanvasState, SketchConfig> {
  gl: WebGLRenderingContext;
}

export interface FrameProps<CanvasState, SketchConfig = undefined> {
  ctx: CanvasRenderingContext2D | null;
  gl: WebGLRenderingContext | null;
  renderer: THREE.WebGLRenderer | null;
  width: number;
  height: number;
  dpr: number;
  state: CanvasState;
  timestamp: number;
  delta: number;
  config: SketchConfig;
  hasChanged: boolean;
  xrFrame?: XRFrame;
}

export interface EventProps<
  CanvasState,
  SketchConfig = undefined,
  TEvent = Event
> {
  event: TEvent;
  ctx: CanvasRenderingContext2D | null;
  gl: WebGLRenderingContext | null;
  renderer: THREE.WebGLRenderer | null;
  width: number;
  height: number;
  dpr: number;
  state: CanvasState;
  timestamp: number;
  config: SketchConfig;
}

export type InitFn<CanvasState, SketchConfig> = (
  props: InitProps<CanvasState, SketchConfig>
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
    lastTimestamp: 0,
    hasChanged: true,
    sketchbookConfig: sketchbookConfig,
    canvas: null as HTMLCanvasElement | null,
    ctx: null as CanvasRenderingContext2D | null,
    gl: null as WebGLRenderingContext | null,
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

  const config = sketchbookConfig.sketchConfig;
  // Store as a string as it has to be copied every time it's used anyway
  const flattenedConfig: Record<string, any> = {};
  const flattenConfig = (config: Record<string, any>) => {
    for (const [key, value] of Object.entries(config)) {
      if (typeof value === 'object') {
        flattenConfig(value);
      } else {
        flattenedConfig[key] = value;
      }
    }
  };
  if (config) {
    flattenConfig(config);
  }
  const initialConfig = JSON.stringify(flattenedConfig);

  if (sketchbookConfig.pageBg) {
    document.body.style.background = sketchbookConfig.pageBg;
  }

  if (sketchbookConfig.type === 'context2d') {
    data.ctx = canvasEl.getContext('2d');

    if (!data.ctx) {
      throw new Error('No canvas context');
    }
  } else if (sketchbookConfig.type === 'webgl') {
    data.gl = canvasEl.getContext('webgl');

    if (!data.gl) {
      throw new Error('No canvas context');
    }
  } else {
    data.renderer = new THREE.WebGLRenderer({
      canvas: canvasEl,
      antialias: !sketchbookConfig.postprocessing,
      stencil: !sketchbookConfig.postprocessing,
      depth: !sketchbookConfig.postprocessing,
      alpha: !!sketchbookConfig.xr?.enabled,
    });
    data.renderer.info.autoReset = false;

    if (sketchbookConfig.xr?.enabled) {
      data.renderer.xr.enabled = true;

      const xrButton = sketchbookConfig.xr.permissionsButton(data.renderer);
      document.body.appendChild(xrButton);
    }
  }

  setSize();

  const initProps: InitProps<CanvasState, SketchConfig> = {
    ctx: data.ctx,
    gl: data.gl,
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

      const isWindowBig = Math.min(window.innerWidth, window.innerHeight) > 600;
      const storedPref = localStorage.getItem(`closed-${location.pathname}`);
      const pane = new Pane({
        title: 'Controls',
        expanded:
          !window.frameElement &&
          (isWindowBig || storedPref !== null) &&
          storedPref !== 'true',
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

      if (cb) {
        cb({ pane: tab.pages[0], config, actualPane: pane });
      } else {
        tab.pages[1].selected = true;
      }

      tab.pages[0].addButton({ title: 'Reset' }).on('click', () => {
        pane.importPreset(JSON.parse(initialConfig));
      });

      const preset = localStorage.getItem(presetName);
      if (preset && !sketchbookConfig.capture?.enabled) {
        try {
          pane.importPreset(JSON.parse(preset));
        } catch (err) {
          console.error('Failed to set from preset', err);
        }
      }
    },
    addEvent: (type, cb) => {
      const canvas =
        data.ctx?.canvas || data.gl?.canvas || data.renderer?.domElement;
      if (!canvas) throw new Error('???');

      (canvas as HTMLCanvasElement).addEventListener(type, (event) => {
        event.preventDefault();

        const hasChanged = cb({
          event,
          ctx: data.ctx,
          gl: data.gl,
          renderer: data.renderer,
          width: data.width,
          height: data.height,
          dpr: data.dpr,
          state: data.canvasState as CanvasState,
          timestamp: data.lastTimestamp,
          config: data.sketchbookConfig.sketchConfig,
        });

        if (hasChanged) {
          data.hasChanged = true;
        }
      });
    },
    testSupport: (cb) => {
      const supported = cb();

      if (supported === true) {
        return;
      }

      writeScreen(data, (ctx: CanvasRenderingContext2D) => {
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        const mult = window.innerWidth < 550 ? 0.5 : 1;
        ctx.font = `bold ${
          70 * mult
        }px Roboto Mono, Source Code Pro, Menlo, Courier, monospace`;
        ctx.fillStyle = 'red';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          'browser not supported :(',
          data.width / 2,
          data.height / 2 - 50 * mult
        );

        ctx.font = `${
          40 * mult
        }px Roboto Mono, Source Code Pro, Menlo, Courier, monospace`;
        ctx.fillStyle = 'white';
        ctx.fillText(supported, data.width / 2, data.height / 2 + 50 * mult);
      });

      throw new Error('Sketch not supported in this browser');
    },
  };

  if (sketchbookConfig.showLoading && !sketchbookConfig.capture?.enabled) {
    const drawLoadingToCanvas = (ctx: CanvasRenderingContext2D) => {
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

      ctx.font = '16px Roboto Mono, Source Code Pro, Menlo, Courier, monospace';
      ctx.fillStyle = 'white';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('loading!', data.width / 2, data.height / 2);
    };
    writeScreen(data, drawLoadingToCanvas);

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
    directory:
      sketchbookConfig.capture?.directory || location.pathname.slice(1),
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

  if (sketchbookConfig.xr?.enabled && data.renderer) {
    data.renderer.setAnimationLoop((timestamp, xrFrame) => {
      if (data.renderer?.xr.isPresenting) {
        callFrame(timestamp, xrFrame);
      }
    });
  } else {
    callFrame(0);
  }

  window.addEventListener('resize', handleResize);

  async function callFrame(timestamp: number, xrFrame?: XRFrame) {
    if (data.fpsGraph) {
      data.fpsGraph.begin();
    }

    data.lastTimestamp = timestamp;

    if (!sketchbookConfig.capture?.enabled && !sketchbookConfig.xr?.enabled) {
      data.animationFrame = requestAnimationFrame(callFrame);
    }

    const hasChanged = data.hasChanged || sketchbookConfig.animate;

    if (hasChanged) {
      const frameProps: FrameProps<CanvasState, SketchConfig> = {
        ctx: data.ctx,
        gl: data.gl,
        renderer: data.renderer,
        width: data.width,
        height: data.height,
        dpr: data.dpr,
        state: data.canvasState as CanvasState,
        timestamp,
        delta: timestamp - data.previousFrameTime,
        config: data.sketchbookConfig.sketchConfig,
        // hasChanged can be used to see if the config has changed
        hasChanged: data.hasChanged,
        xrFrame,
      };

      if (data.renderer) {
        // Auto reset doesn't work when postprocessing is used
        data.renderer.info.reset();
      }

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

    const dpr = config.capture?.enabled ? 1 : window.devicePixelRatio;
    const canvasDpr = config.type !== 'threejs' ? dpr : 1;
    const threeDpr = config.type === 'threejs' ? dpr : 1;
    data.width = (config?.width ?? window.innerWidth) * canvasDpr;
    data.height = (config?.height ?? window.innerHeight) * canvasDpr;
    data.dpr = dpr;
    canvasEl.width = data.width;
    canvasEl.height = data.height;
    canvasEl.style.width = `${data.width / canvasDpr}px`;
    canvasEl.style.height = `${data.height / canvasDpr}px`;

    canvasEl.classList.toggle(
      'custom-size',
      !!(config?.width && config?.height)
    );

    data.hasChanged = true;

    if (data.gl) {
      data.gl.viewport(0, 0, data.width, data.height);
    } else if (data.renderer) {
      data.renderer.setSize(data.width, data.height);
      data.renderer.setPixelRatio(threeDpr);
    }
    if (
      typeof data.canvasState === 'object' &&
      data.canvasState &&
      'composer' in data.canvasState
    ) {
      const composer: any = data.canvasState.composer;
      composer.setSize(data.width, data.height);
      composer.setPixelRatio(threeDpr);
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

// Skypack doesn't like it when there isn't a default export
export default {};
