import type * as THREE from 'three';
import type { CallFrameFn, FrameProps, InitProps } from '../renderers/vanilla';

export interface SketchPlugin<CanvasState, UserConfig> {
  readonly name: string;

  hasChanged?: boolean;

  onThreeRenderer?(renderer: THREE.WebGLRenderer): void;
  customAnimationLoop?(callFrame: CallFrameFn): boolean;

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
