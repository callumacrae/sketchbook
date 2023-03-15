import writeScreen from '../canvas/written-screen';
import type { SketchPlugin } from '../plugins/interface';

type Type = 'context2d' | 'webgl' | 'webgl2' | 'custom';

// TODO MOVE INTO PLUGINS:
// - browser support?
// - add events?

export interface SketchConfig<CanvasState = undefined, UserConfig = undefined> {
  type: Type;
  isPreview: boolean;
  showLoading: boolean;
  animate: boolean;
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
  gl2: WebGL2RenderingContext | null;
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
  gl2: WebGL2RenderingContext | null;
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
  gl2: WebGL2RenderingContext | null;
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
    gl2: null as WebGL2RenderingContext | null,
    customRenderer: null as SketchPlugin<CanvasState, UserConfig> | null,
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

  for (const plugin of sketchConfig.plugins) {
    if (plugin.setupPlugin) {
      plugin.setupPlugin({
        getCanvas: () => canvasEl,
        getSketchConfig: () => sketchConfig,
        getCanvasState: () => data.canvasState,
        getPlugins: () => sketchConfig.plugins,
        getSize: () => ({
          width: data.width,
          height: data.height,
          dpr: data.dpr,
        }),
      });
    }
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
  } else if (sketchConfig.type === 'webgl2') {
    data.gl2 = canvasEl.getContext('webgl2');

    if (!data.gl2) {
      throw new Error('No canvas context');
    }
  } else if (sketchConfig.type === 'custom') {
    for (const plugin of sketchConfig.plugins) {
      if (plugin.customRenderer) {
        const isCustomRenderer = plugin.customRenderer(canvasEl);
        if (!isCustomRenderer) continue;

        data.customRenderer = plugin;

        for (const plugin of sketchConfig.plugins) {
          if (plugin.onCustomRenderer) {
            plugin.onCustomRenderer(plugin);
          }
        }
        break;
      }
    }

    if (!data.customRenderer) {
      throw new Error('Type set to "custom" but no custom renderer found');
    }
  } else {
    throw new Error('Sketch type unknown');
  }

  setSize();

  const initProps: InitProps<CanvasState, UserConfig> = {
    ctx: data.ctx,
    gl: data.gl,
    gl2: data.gl2,
    width: data.width,
    height: data.height,
    dpr: data.dpr,
    timestamp: 0,
    userConfig,
    sketchConfig,
    addEvent: (type, cb) => {
      canvasEl.addEventListener(type, (event) => {
        event.preventDefault();

        const hasChanged = cb({
          event,
          ctx: data.ctx,
          gl: data.gl,
          gl2: data.gl2,
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

  if (sketchConfig.showLoading) {
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

  let customAnimationLoop = false;

  const callFrame: CallFrameFn = async (unadjustedTimestamp: number) => {
    let timestamp = unadjustedTimestamp + data.timestampOffset;

    data.lastTimestamp = timestamp;

    if (!customAnimationLoop) {
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
        gl2: data.gl2,
        width: data.width,
        height: data.height,
        dpr: data.dpr,
        state: data.canvasState as CanvasState,
        timestamp,
        delta: timestamp - data.previousFrameTime,
        userConfig: data.sketchConfig.userConfig,
        sketchConfig: data.sketchConfig,
        // hasChanged can be used to see if the userConfig has changed
        hasChanged: pluginHasChanged || data.hasChanged,
      };

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

    let width = sketchConfig.width ?? wrapperRect?.width ?? window.innerWidth;
    let height =
      sketchConfig.height ?? wrapperRect?.height ?? window.innerHeight;
    let dpr = window.devicePixelRatio;

    for (const plugin of sketchConfig.plugins) {
      if (plugin.onBeforeSetSize) {
        const override = plugin.onBeforeSetSize();
        if (typeof override?.width === 'number') {
          width = override.width;
        }
        if (typeof override?.height === 'number') {
          height = override.height;
        }
        if (typeof override?.dpr === 'number') {
          dpr = override.dpr;
        }
      }
    }

    data.width = width * dpr;
    data.height = height * dpr;
    data.dpr = dpr;

    canvasEl.width = data.width;
    canvasEl.height = data.height;
    canvasEl.style.width = `${data.width / dpr}px`;
    canvasEl.style.height = `${data.height / dpr}px`;

    canvasEl.classList.toggle(
      'custom-size',
      !!(sketchConfig.width && sketchConfig.height)
    );

    data.hasChanged = true;

    const gl = data.gl || data.gl2;
    if (gl) {
      gl.viewport(0, 0, data.width, data.height);
    }

    for (const plugin of sketchConfig.plugins) {
      if (plugin.onSetSize) {
        plugin.onSetSize(data.width, data.height, dpr);
      }
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
