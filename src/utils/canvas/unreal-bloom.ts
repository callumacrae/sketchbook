import { Vector3 } from 'three/src/math/Vector3.js';

import shrinkCanvas from './shrink';
import blurCanvas from './gaussian-blur';
import { ensureCanvas2DContext } from './utils';

export type BloomConfig = {
  passes: number;
  strength: number;
  radius: number;
};

export default function bloomCanvas(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  config: BloomConfig
) {
  const ctx = canvas.getContext('2d');
  ensureCanvas2DContext(ctx);
  const { width, height } = canvas;

  const bloomPasses = config.passes;

  let lastCanvas: HTMLCanvasElement | OffscreenCanvas = ctx.canvas;
  const blurData: ImageData[] = [];
  let resX = width;
  let resY = height;
  for (let i = 0; i < bloomPasses; i++) {
    resX = Math.round(resX / 2);
    resY = Math.round(resY / 2);
    const mipmap = shrinkCanvas(lastCanvas, resX, resY);
    const blur = blurCanvas(mipmap, 3 + i * 2);
    const blurCtx = blur.getContext('2d');
    ensureCanvas2DContext(blurCtx);
    const imageData = blurCtx.getImageData(0, 0, resX, resY);
    blurData.push(imageData);
    lastCanvas = blur;
  }

  const bloomStrength = config.strength;
  const bloomRadius = config.radius;

  const lerpBloomFactor = (factor: number) => {
    return factor * (1 - bloomRadius) + (1.2 - factor) * bloomRadius;
  };

  const texture2D = (texture: ImageData, [u, v]: number[]) => {
    const x1 = Math.floor(texture.width * u);
    const x2 = Math.ceil(texture.width * u);
    const y1 = Math.floor(texture.height * v);
    const y2 = Math.ceil(texture.height * v);
    const xOffset = (texture.width * u) % 1;
    const yOffset = (texture.height * v) % 1;

    if (x1 === x2 && y1 === y2) {
      const i = (y1 * texture.width + x1) * 4;
      return [texture.data[i], texture.data[i + 1], texture.data[i + 2]];
    } else {
      const x1y1 = new Vector3(
        texture.data[(y1 * texture.width + x1) * 4],
        texture.data[(y1 * texture.width + x1) * 4 + 1],
        texture.data[(y1 * texture.width + x1) * 4 + 2]
      );
      const x2y1 = new Vector3(
        texture.data[(y1 * texture.width + x2) * 4],
        texture.data[(y1 * texture.width + x2) * 4 + 1],
        texture.data[(y1 * texture.width + x2) * 4 + 2]
      );
      const x1y2 = new Vector3(
        texture.data[(y2 * texture.width + x1) * 4],
        texture.data[(y2 * texture.width + x1) * 4 + 1],
        texture.data[(y2 * texture.width + x1) * 4 + 2]
      );
      const x2y2 = new Vector3(
        texture.data[(y2 * texture.width + x2) * 4],
        texture.data[(y2 * texture.width + x2) * 4 + 1],
        texture.data[(y2 * texture.width + x2) * 4 + 2]
      );

      const resultY1 = x1y1
        .multiplyScalar(1 - xOffset)
        .add(x2y1.multiplyScalar(xOffset));
      const resultY2 = x1y2
        .multiplyScalar(1 - xOffset)
        .add(x2y2.multiplyScalar(xOffset));
      const result = resultY1
        .multiplyScalar(1 - yOffset)
        .add(resultY2.multiplyScalar(yOffset));

      // Cursed and broken but very very cool
      // const x1y1Factor = (x2 - u) * (y2 - v);
      // const x2y1Factor = (u - x1) * (y2 - v);
      // const x1y2Factor = (x2 - u) * (v - y1);
      // const x2y2Factor = (u - x1) * (v - y1);
      //
      // const result = x1y1
      //   .multiplyScalar(x1y1Factor)
      //   .add(x2y1.multiplyScalar(x2y1Factor))
      //   .add(x1y2.multiplyScalar(x1y2Factor))
      //   .add(x2y2.multiplyScalar(x2y2Factor));

      return [result.x, result.y, result.z];
    }
  };

  // TODO: support non-greyscale
  const bloomAtPixel = (uv: number[]) => {
    let bloom = 0;
    for (let i = 0; i < bloomPasses; i++) {
      const [r] = texture2D(blurData[i], uv);
      bloom += lerpBloomFactor(1 - i / bloomPasses) * r;
    }
    return bloomStrength * bloom;
  };

  const ctxImageData = ctx.getImageData(0, 0, width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const bloom = bloomAtPixel([x / width, y / height]);
      ctxImageData.data[i] += bloom;
      ctxImageData.data[i + 1] += bloom;
      ctxImageData.data[i + 2] += bloom;
    }
  }

  ctx.putImageData(ctxImageData, 0, 0);
}
