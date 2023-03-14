import type { CallFrameFn, FrameProps } from '../renderers/vanilla';
import type { PluginCommunicator, SketchPlugin } from './interface';

export interface CapturePluginConfig {
  enabled: boolean;
  duration: number;
  fps?: number;
  directory?: string;
}

export default class CapturePlugin<CanvasState, UserConfig>
  implements SketchPlugin<CanvasState, UserConfig>
{
  readonly name = 'capture';

  private config: CapturePluginConfig;
  private captureData: {
    frames: Record<string, string>;
    frameDuration: number;
    frameCount: number;
    framesNameLength: number;
    frameNumber: number;
    directory: string;
  };
  private sketch?: PluginCommunicator<CanvasState, UserConfig>;
  private callFrame?: CallFrameFn;

  constructor(config: CapturePluginConfig) {
    this.config = config;

    // https://macr.ae/article/canvas-to-gif
    this.captureData = {
      frames: {},
      frameDuration: 0,
      frameCount: 0,
      framesNameLength: 0,
      frameNumber: 0,
      directory: this.config.directory || location.pathname.slice(1),
    };
    this.captureData.frameDuration = 1e3 / (config.fps || 24);
    this.captureData.frameCount = Math.round(
      this.config.duration / this.captureData.frameDuration
    );
    this.captureData.framesNameLength = Math.ceil(
      Math.log10(this.captureData.frameCount)
    );
  }

  setupPlugin(sketch: typeof this.sketch) {
    this.sketch = sketch;
  }

  customAnimationLoop(callFrame: CallFrameFn) {
    if (!this.sketch) return false;

    this.callFrame = callFrame;

    // Note: we can't call callFrame synchronously here, because
    // customAnimationLoop hasn't been set to true yet
    requestAnimationFrame(() => {
      callFrame(0);
    });

    return true;
  }

  onBeforeSetSize() {
    if (this.config?.enabled) {
      return { dpr: 1 };
    }
  }

  onFrame({ timestamp }: FrameProps<CanvasState, UserConfig>) {
    if (!this.sketch) throw new Error('Plugin not set up');

    const canvasEl = this.sketch.getCanvas();

    const frameName = this.captureData.frameNumber
      .toString()
      .padStart(this.captureData.framesNameLength, '0');
    console.info(`Capturing frame ${frameName}`);
    this.captureData.frames[frameName] = canvasEl.toDataURL('image/png');

    if (timestamp > this.config.duration) {
      console.log(
        `Sending ${
          Object.keys(this.captureData.frames).length
        } frames to server`
      );
      fetch('http://localhost:3000/save-images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(this.captureData),
      });
    } else {
      this.captureData.frameNumber++;
      const timestamp =
        this.captureData.frameNumber * this.captureData.frameDuration;
      requestAnimationFrame(() => {
        if (!this.callFrame) throw new Error('Plugin not set up');
        this.callFrame(timestamp);
      });
    }
  }
}
