import generateLightning from '../shapes/lightning';
import { doWorkOffscreen, ensureCanvas2DContext } from '../canvas/utils';
import bloomCanvas from '../canvas/unreal-bloom';
import shrinkCanvas from '../canvas/shrink';
import type {
  GenerateLightningConfig,
  LightningNode,
} from '../shapes/lightning';
import type { BloomConfig } from '../canvas/unreal-bloom';

export interface LightningWorkerMessageIn {
  type: 'generate';
  props: {
    seed?: string | null;
    width: number;
    height: number;
    config: GenerateLightningConfig & {
      maxWidth: number;
      visualisation: {
        charSize: number;
        [key: string]: any;
      };
      bloom: BloomConfig & {
        enabled: boolean;
      };
    };
  };
}

export interface LightningWorkerMessageOut {
  type: 'generated';
  data: Uint8Array;
  width: number;
  height: number;
}

self.onmessage = (event: MessageEvent<LightningWorkerMessageIn>) => {
  if (event.data.type === 'generate') {
    const { props } = event.data;
    const { config } = props;

    const width = Math.floor(props.width / config.visualisation.charSize) * 2;
    const height = Math.floor(props.height / config.visualisation.charSize) * 2;

    const lightning = generateLightning(props.seed || null, {
      config: {
        branch: config.branch,
        wobble: config.wobble,
        origin: 'random',
      },
      width,
      height,
    });

    const oversizedCanvas = doWorkOffscreen(width, height, (ctx) => {
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, width, height);
      ctx.lineCap = 'round';
      ctx.strokeStyle = config.bloom.enabled ? '#777' : 'white';

      const drawNode = (
        lightning: LightningNode,
        repeat = false,
        maxCharge = lightning.charge
      ) => {
        for (const next of lightning.next) {
          if (!next.isReturn && repeat) continue;

          ctx.lineWidth = next.isReturn
            ? config.maxWidth
            : 1 + (next.charge / maxCharge) * config.maxWidth * 1.5;
          ctx.beginPath();
          ctx.moveTo(lightning.pos.x, lightning.pos.y);
          ctx.lineTo(next.pos.x, next.pos.y);
          ctx.stroke();
          drawNode(next, repeat, maxCharge);
        }
      };

      drawNode(lightning);

      if (config.bloom.enabled) {
        bloomCanvas(ctx.canvas, config.bloom);
      }
    });

    const canvas = shrinkCanvas(oversizedCanvas, width / 2, height / 2);

    const ctx = canvas.getContext('2d');
    ensureCanvas2DContext(ctx);

    const data = ctx.getImageData(0, 0, width / 2, height / 2);
    const src = new Uint8Array(data.data.length / 4);
    for (let i = 0; i < src.length; i++) {
      src[i] = data.data[i * 4];
    }

    self.postMessage({
      type: 'generated',
      data: src,
      width: width / 2,
      height: height / 2,
    });
  } else {
    throw new Error('unknown type', event.data.type);
  }
};

// Skypack doesn't like it when there isn't a default export
export default {};
