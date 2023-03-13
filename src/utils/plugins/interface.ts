import type {
  CallFrameFn,
  FrameProps,
  InitProps,
  SketchConfig,
} from '../renderers/vanilla';

export interface PluginCommunicator<CanvasState, UserConfig> {
  getCanvas: () => HTMLCanvasElement;
  getSketchConfig: () => SketchConfig<CanvasState, UserConfig>;
  getCanvasState: () => CanvasState | undefined;
  getPlugins: () => SketchPlugin<CanvasState, UserConfig>[];
  getSize: () => { width: number; height: number; dpr: number };
}

export interface SketchPlugin<CanvasState, UserConfig> {
  readonly name: string;

  hasChanged?: boolean;

  setupPlugin?(communicator: PluginCommunicator<CanvasState, UserConfig>): void;

  customRenderer?(canvasEl: HTMLCanvasElement): boolean;
  onCustomRenderer?(plugin: SketchPlugin<CanvasState, UserConfig>): void;
  customAnimationLoop?(callFrame: CallFrameFn): boolean;
  onSetSize?(width: number, height: number, dpr: number): void;

  onWriteScreen?(cb: (ctx: CanvasRenderingContext2D) => void): boolean;

  onBeforeInit?(initProps: InitProps<CanvasState, UserConfig>): void;
  onInit?(
    initProps: InitProps<CanvasState, UserConfig>,
    state: CanvasState | void
  ): void;

  onBeforeFrame?(frameProps: FrameProps<CanvasState, UserConfig>): void;
  onFrame?(
    frameProps: FrameProps<CanvasState, UserConfig>,
    newState: CanvasState | void
  ): void;

  onDispose?(): void;
}
