import { Pane } from 'tweakpane';
import * as EssentialsPlugin from '@tweakpane/plugin-essentials';
import * as THREE from 'three';
import type { FpsGraphBladeApi } from '@tweakpane/plugin-essentials/dist/types/fps-graph/api/fps-graph';

export interface Config<SketchConfig = undefined> {
  type: 'context2d' | 'threejs';
  animate: boolean;
  capture?: {
    enabled: boolean;
    duration: number;
    fps?: number;
    directory: string;
  };
  width?: number;
  height?: number;
  pageBg?: string;
  resizeDelay: number;
  sketchConfig: SketchConfig;
}

export interface InitControlsProps<SketchConfig> {
  pane: Pane;
  config: SketchConfig;
}

export interface InitProps<SketchConfig = undefined> {
  ctx: CanvasRenderingContext2D | null;
  renderer: THREE.WebGLRenderer | null;
  width: number;
  height: number;
  timestamp: number;
  config?: SketchConfig;
  initControls: (cb: (props: InitControlsProps<SketchConfig>) => void) => void;
}

export interface FrameProps<CanvasState, SketchConfig = undefined> {
  ctx: CanvasRenderingContext2D | null;
  renderer: THREE.WebGLRenderer | null;
  width: number;
  height: number;
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
      animate: true,
      resizeDelay: 50,
      sketchConfig: {} as SketchConfig,
    },
    sketchbookConfigIn
  );

  const data = {
    width: 0,
    height: 0,
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

  if (sketchbookConfig.pageBg) {
    document.body.style.background = sketchbookConfig.pageBg;
  }

  setSize();

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
    data.renderer.setSize(data.width, data.height);
  }

  const initProps: InitProps<SketchConfig> = {
    ctx: data.ctx,
    renderer: data.renderer,
    width: data.width,
    height: data.height,
    timestamp: 0,
    config,
    initControls: (cb) => {
      if (!config) {
        return;
      }

      const pane = new Pane({
        title: 'Controls',
        expanded: !window.frameElement,
      });
      pane.registerPlugin(EssentialsPlugin);
      data.pane = pane;
      data.fpsGraph = pane.addBlade({
        view: 'fpsgraph',
        label: 'FPS',
        lineCount: 2,
      }) as FpsGraphBladeApi;

      pane.on('change', () => {
        data.hasChanged = true;
      });

      cb({ pane, config });
    },
  };

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

    const dpr = window.devicePixelRatio;
    const dprMultiplier = config.type === 'threejs' ? 1 : dpr;
    data.width = config?.width ?? window.innerWidth * dprMultiplier;
    data.height = config?.height ?? window.innerHeight * dprMultiplier;
    canvasEl.width = data.width;
    canvasEl.height = data.height;

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
    if (canvasState?.camera instanceof THREE.Camera) {
      canvasState.camera.aspect = data.width / data.height;
      canvasState.camera.updateProjectionMatrix();
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
