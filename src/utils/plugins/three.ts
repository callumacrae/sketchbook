import type { PerspectiveCamera, WebGLRenderer } from 'three';

import type { PluginCommunicator, SketchPlugin } from './interface';

type PartialThree = {
  WebGLRenderer: typeof WebGLRenderer;
  PerspectiveCamera: typeof PerspectiveCamera;
  [extra: string]: any;
};

export interface ThreePluginConfig {
  postprocessing?: boolean;
}

export default class ThreePlugin<CanvasState, UserConfig>
  implements SketchPlugin<CanvasState, UserConfig>
{
  readonly name = 'three';

  private threeInstance: PartialThree;
  private config: ThreePluginConfig;
  private sketch?: PluginCommunicator<CanvasState, UserConfig>;

  renderer?: WebGLRenderer;

  constructor(threeInstance: PartialThree, configIn?: ThreePluginConfig) {
    this.threeInstance = threeInstance;
    this.config = Object.assign(
      {
        postprocessing: false,
      },
      configIn
    );
  }

  setupPlugin(sketch: typeof this.sketch) {
    this.sketch = sketch;
  }

  customRenderer(canvasEl: HTMLCanvasElement) {
    const { WebGLRenderer } = this.threeInstance;
    this.renderer = new WebGLRenderer({
      canvas: canvasEl,
      antialias: !this.config.postprocessing,
      stencil: !this.config.postprocessing,
      depth: !this.config.postprocessing,
    });
    this.renderer.info.autoReset = false;

    return true;
  }

  onBeforeSetSize() {
    return { dpr: 1 };
  }

  onSetSize(width: number, height: number, dpr: number) {
    if (!this.renderer || !this.sketch) return;

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    const state = this.sketch.getCanvasState() as any;
    if (!state) return;

    if (
      'composer' in state &&
      'setSize' in state.composer &&
      'setPixelRatio' in state.composer
    ) {
      state.composer.setSize(width, height);
      state.composer.setPixelRatio(dpr);
    }
    const camera = state.camera?.camera || state?.camera;
    if (camera instanceof this.threeInstance.PerspectiveCamera) {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
  }

  onWriteScreen(cb: (ctx: CanvasRenderingContext2D) => void) {
    if (!this.sketch || !this.renderer)
      throw new Error('ThreePlugin: Plugin not setup yet.');

    const THREE = this.threeInstance;
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
    scene.add(camera);

    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) throw new Error('Could not create canvas context');

    const { width, height } = this.sketch.getSize();
    ctx.canvas.width = width;
    ctx.canvas.height = height;
    cb(ctx);

    const plane = new THREE.PlaneGeometry(2, 2);
    const texture = new THREE.CanvasTexture(ctx.canvas);
    const material = new THREE.MeshBasicMaterial({ map: texture });
    scene.add(new THREE.Mesh(plane, material));

    this.renderer.render(scene, camera);

    return true;
  }

  onBeforeFrame() {
    if (!this.renderer) return;

    // Auto reset doesn't work when postprocessing is used
    this.renderer.info.reset();
  }

  onDispose() {
    if (!this.renderer) return;

    this.renderer.dispose();
    this.renderer = undefined;
  }
}
