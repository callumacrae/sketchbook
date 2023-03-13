import { ARButton } from 'three/examples/jsm/webxr/ARButton';
import type { ARButtonSessionInit } from 'three/examples/jsm/webxr/ARButton';
import type * as THREE from 'three';

import type { CallFrameFn } from '../renderers/vanilla';
import type { SketchPlugin } from './interface';

export default class ThreeXRPlugin<CanvasState, UserConfig>
  implements SketchPlugin<CanvasState, UserConfig>
{
  readonly name = 'three-xr';

  xrFrame?: XRFrame;

  private sessionInit?: Partial<ARButtonSessionInit>;
  private renderer?: THREE.WebGLRenderer;

  constructor(sessionInit?: Partial<ARButtonSessionInit>) {
    this.sessionInit = sessionInit;
  }

  onCustomRenderer(plugin: SketchPlugin<CanvasState, UserConfig>) {
    if (plugin.name === 'three') {
      const { renderer } = plugin as any;
      this.renderer = renderer;

      renderer.setClearAlpha(0);
      renderer.xr.enabled = true;

      const xrButton = ARButton.createButton(renderer, this.sessionInit);
      document.body.appendChild(xrButton);
    }
  }

  customAnimationLoop(callFrame: CallFrameFn) {
    if (!this.renderer) return false;

    this.renderer.setAnimationLoop((timestamp, xrFrame) => {
      this.xrFrame = xrFrame;

      if (this.renderer?.xr.isPresenting) {
        callFrame(timestamp);
      }
    });

    return true;
  }
}
