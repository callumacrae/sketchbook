import * as THREE from 'three';
import writeScreen from '../canvas/written-screen';
import type { SketchPlugin } from '../plugins/interface';

type Type = 'context2d' | 'webgl' | 'threejs';

export interface SketchConfig<CanvasState = undefined, UserConfig = undefined> {
  type: Type;
  isPreview: boolean;
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
  maxDelta: number;
  userConfig: UserConfig;
  plugins: SketchPlugin<CanvasState, UserConfig>[];
}

export interface InitProps<CanvasState, UserConfig = undefined> {
  ctx: CanvasRenderingContext2D | null;
  gl: WebGLRenderingContext | null;
  renderer: THREE.WebGLRenderer | null;
  width: number;
  height: number;
  dpr: number;
  timestamp: number;
  userConfig: UserConfig;
  sketchConfig: SketchConfig<CanvasState, UserConfig>;
  addEvent<K extends keyof HTMLElementEventMap>(
    type: K,
    cb: (
      props: EventProps<CanvasState, UserConfig, HTMLElementEventMap[K]>
    ) => boolean | void
  ): void;
  testSupport(cb: () => true | string): void;
}

export type CallFrameFn = (unadjustedTimestamp: number) => Promise<void>;

export interface FrameProps<CanvasState, UserConfig = undefined> {
  ctx: CanvasRenderingContext2D | null;
  gl: WebGLRenderingContext | null;
  renderer: THREE.WebGLRenderer | null;
  width: number;
  height: number;
  dpr: number;
  state: CanvasState;
  timestamp: number;
  delta: number;
  userConfig: UserConfig;
  sketchConfig: SketchConfig<CanvasState, UserConfig>;
  hasChanged: boolean;
}

export interface EventProps<
  CanvasState,
  UserConfig = undefined,
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
  userConfig: UserConfig;
  sketchConfig: SketchConfig<CanvasState, UserConfig>;
}

export type InitFn<CanvasState, UserConfig> = (
  props: InitProps<CanvasState, UserConfig>
) => CanvasState | Promise<CanvasState>;
export type FrameFn<CanvasState, UserConfig = undefined> = (
  props: FrameProps<CanvasState, UserConfig>
) => Promise<CanvasState | void> | CanvasState | void;

export async function toVanillaCanvas<
  CanvasState = undefined,
  UserConfig = undefined
>(
  canvasEl: HTMLCanvasElement | null,
  init: InitFn<CanvasState, UserConfig>,
  frame: FrameFn<CanvasState, UserConfig>,
  sketchConfigIn: Partial<SketchConfig<CanvasState, UserConfig>> = {}
) {
  const sketchConfig: SketchConfig<CanvasState, UserConfig> = Object.assign(
    {
      type: 'context2d',
      isPreview: false,
      showLoading: false,
      animate: true,
      resizeDelay: 50,
      maxDelta: (1000 / 60) * 4,
      userConfig: {} as UserConfig,
      plugins: [],
    },
    sketchConfigIn
  );

  const data = {
    frameFn: frame,
    width: 0,
    height: 0,
    dpr: 0,
    lastTimestamp: 0,
    // Used to adjust timestamp after clamping delta to maxDelta
    timestampOffset: 0,
    hasChanged: true,
    sketchConfig,
    canvas: null as HTMLCanvasElement | null,
    ctx: null as CanvasRenderingContext2D | null,
    gl: null as WebGLRenderingContext | null,
    renderer: null as THREE.WebGLRenderer | null,
    resizeTimeout: undefined as ReturnType<typeof setTimeout> | undefined,
    previousFrameTime: 0,
    animationFrame: undefined as
      | ReturnType<typeof requestAnimationFrame>
      | undefined,
    canvasState: undefined as CanvasState | undefined,
  };

  if (!canvasEl) {
    throw new Error('No canvas');
  }

  const userConfig = sketchConfig.userConfig;

  if (sketchConfig.pageBg && !sketchConfig.isPreview) {
    document.body.style.background = sketchConfig.pageBg;
  }

  if (sketchConfig.type === 'context2d') {
    data.ctx = canvasEl.getContext('2d');

    if (!data.ctx) {
      throw new Error('No canvas context');
    }
  } else if (sketchConfig.type === 'webgl') {
    data.gl = canvasEl.getContext('webgl');

    if (!data.gl) {
      throw new Error('No canvas context');
    }
  } else {
    data.renderer = new THREE.WebGLRenderer({
      canvas: canvasEl,
      antialias: !sketchConfig.postprocessing,
      stencil: !sketchConfig.postprocessing,
      depth: !sketchConfig.postprocessing,
    });
    data.renderer.info.autoReset = false;

    for (const plugin of sketchConfig.plugins) {
      if (plugin.onThreeRenderer) {
        plugin.onThreeRenderer(data.renderer);
      }
    }
  }

  setSize();

  const initProps: InitProps<CanvasState, UserConfig> = {
    ctx: data.ctx,
    gl: data.gl,
    renderer: data.renderer,
    width: data.width,
    height: data.height,
    dpr: data.dpr,
    timestamp: 0,
    userConfig,
    sketchConfig,
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
          userConfig: data.sketchConfig.userConfig,
          sketchConfig: data.sketchConfig,
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

        const sizeFactor = data.width / data.dpr < 550 ? 0.6 : 1;
        ctx.font = `bold ${
          80 * sizeFactor
        }px Shantell Sans, Roboto Mono, Source Code Pro, Menlo, Courier, monospace`;
        ctx.fillStyle = 'red';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          'browser not supported :(',
          data.width / 2,
          data.height / 2 - 50 * sizeFactor
        );

        ctx.font = `${
          50 * sizeFactor
        }px Shantell Sans, Roboto Mono, Source Code Pro, Menlo, Courier, monospace`;
        ctx.fillStyle = 'white';
        ctx.fillText(
          supported,
          data.width / 2,
          data.height / 2 + 50 * sizeFactor
        );
      });

      throw new Error('Sketch not supported in this browser');
    },
  };

  if (sketchConfig.showLoading && !sketchConfig.capture?.enabled) {
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

  for (const plugin of sketchConfig.plugins) {
    if (plugin.onBeforeInit) {
      plugin.onBeforeInit(initProps);
    }
  }

  const state = await init(initProps);
  if (state) {
    data.canvasState = state;
  }

  for (const plugin of sketchConfig.plugins) {
    if (plugin.onInit) {
      plugin.onInit(initProps, state);
    }
  }

  // https://macr.ae/article/canvas-to-gif
  const captureData = {
    frames: {} as Record<string, string>,
    frameDuration: 0,
    frameCount: 0,
    framesNameLength: 0,
    frameNumber: 0,
    directory: sketchConfig.capture?.directory || location.pathname.slice(1),
  };
  if (sketchConfig.capture) {
    captureData.frameDuration = 1e3 / (sketchConfig.capture.fps || 24);
    captureData.frameCount = Math.round(
      sketchConfig.capture.duration / captureData.frameDuration
    );
    captureData.framesNameLength = Math.ceil(
      Math.log10(captureData.frameCount)
    );
  }

  let customAnimationLoop = false;

  const callFrame: CallFrameFn = async (unadjustedTimestamp: number) => {
    let timestamp = unadjustedTimestamp + data.timestampOffset;

    data.lastTimestamp = timestamp;

    if (!sketchConfig.capture?.enabled && !customAnimationLoop) {
      data.animationFrame = requestAnimationFrame(callFrame);
    }

    let pluginHasChanged = false;
    for (const plugin of sketchConfig.plugins) {
      if (plugin.hasChanged) {
        pluginHasChanged = true;
        plugin.hasChanged = false;
      }
    }

    const hasChanged =
      pluginHasChanged || data.hasChanged || sketchConfig.animate;

    if (hasChanged) {
      let delta = timestamp - data.previousFrameTime;

      if (delta > sketchConfig.maxDelta) {
        const adjustment = delta - sketchConfig.maxDelta;
        data.timestampOffset -= adjustment;
        timestamp -= adjustment;
        delta = sketchConfig.maxDelta;
      }

      const frameProps: FrameProps<CanvasState, UserConfig> = {
        ctx: data.ctx,
        gl: data.gl,
        renderer: data.renderer,
        width: data.width,
        height: data.height,
        dpr: data.dpr,
        state: data.canvasState as CanvasState,
        // TODO: can we use delta to avoid big jumps in time?
        timestamp,
        delta: timestamp - data.previousFrameTime,
        userConfig: data.sketchConfig.userConfig,
        sketchConfig: data.sketchConfig,
        // hasChanged can be used to see if the userConfig has changed
        hasChanged: pluginHasChanged || data.hasChanged,
      };

      if (data.renderer) {
        // Auto reset doesn't work when postprocessing is used
        data.renderer.info.reset();
      }

      for (const plugin of sketchConfig.plugins) {
        if (plugin.onBeforeFrame) {
          plugin.onBeforeFrame(frameProps);
        }
      }

      const newState = await data.frameFn(frameProps);
      if (newState) {
        data.canvasState = newState;
      }

      for (const plugin of sketchConfig.plugins) {
        if (plugin.onFrame) {
          plugin.onFrame(frameProps, newState);
        }
      }

      data.hasChanged = false;
      data.previousFrameTime = timestamp;
    }

    if (sketchConfig.capture?.enabled && canvasEl) {
      const frameName = captureData.frameNumber
        .toString()
        .padStart(captureData.framesNameLength, '0');
      console.info(`Capturing frame ${frameName}`);
      captureData.frames[frameName] = canvasEl.toDataURL('image/png');

      if (timestamp > sketchConfig.capture.duration) {
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
  };

  for (const plugin of sketchConfig.plugins) {
    if (plugin.customAnimationLoop) {
      const isLoopSet = plugin.customAnimationLoop(callFrame);
      if (isLoopSet) {
        customAnimationLoop = true;
        break;
      }
    }
  }
  if (!customAnimationLoop) {
    callFrame(0);
  }

  window.addEventListener('resize', handleResize);

  function handleResize() {
    if (data.resizeTimeout) {
      clearTimeout(data.resizeTimeout);
    }
    const resizeDelay = data.sketchConfig.resizeDelay;
    data.resizeTimeout = setTimeout(() => setSize(), resizeDelay);
  }

  function setSize() {
    if (!canvasEl) {
      throw new Error('No canvas');
    }

    const sketchConfig = data.sketchConfig;

    const wrapperRect = canvasEl.parentElement?.getBoundingClientRect();

    const dpr = sketchConfig.capture?.enabled ? 1 : window.devicePixelRatio;
    const canvasDpr = sketchConfig.type !== 'threejs' ? dpr : 1;
    const threeDpr = sketchConfig.type === 'threejs' ? dpr : 1;
    data.width =
      (sketchConfig?.width ?? wrapperRect?.width ?? window.innerWidth) *
      canvasDpr;
    data.height =
      (sketchConfig?.height ?? wrapperRect?.height ?? window.innerHeight) *
      canvasDpr;
    data.dpr = dpr;
    canvasEl.width = data.width;
    canvasEl.height = data.height;
    canvasEl.style.width = `${data.width / canvasDpr}px`;
    canvasEl.style.height = `${data.height / canvasDpr}px`;

    canvasEl.classList.toggle(
      'custom-size',
      !!(sketchConfig?.width && sketchConfig?.height)
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
    data,
    updateConfig(newConfig: Partial<typeof sketchConfig>) {
      Object.assign(sketchConfig, newConfig);
    },
    teardown() {
      window.removeEventListener('resize', handleResize);

      if (data.animationFrame) {
        cancelAnimationFrame(data.animationFrame);
      }

      if (data.renderer) {
        data.renderer.dispose();
        data.renderer = null;
      }

      for (const plugin of sketchConfig.plugins) {
        if (plugin.onDispose) {
          plugin.onDispose();
        }
      }
    },
  };
}

// Skypack doesn't like it when there isn't a default export
export default {};
