import type { FrameProps } from '../renderers/vanilla';

export interface SketchPlugin<CanvasState, SketchConfig> {
  readonly type: string;

  onBeforeFrame?(frameProps: FrameProps<CanvasState, SketchConfig>): void;
  onFrame?(
    frameProps: FrameProps<CanvasState, SketchConfig>,
    newState: CanvasState | void
  ): void;
  // TODO: implement this
  onDispose?(): void;
}
