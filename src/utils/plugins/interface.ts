import type { FrameProps, InitProps } from '../renderers/vanilla';

export interface SketchPlugin<CanvasState, UserConfig> {
  readonly name: string;

  hasChanged?: boolean;

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
