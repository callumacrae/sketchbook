import { doWorkOffscreen, ensureCanvas2DContext } from './utils';

export default function blurCanvas(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  kernelSize: number
) {
  if (kernelSize % 2 !== 1) {
    throw new Error('Kernel size must be odd');
  }

  // https://github.com/mrdoob/three.js/blob/62a44c97b4afbd42bebcc0db739a292c102918c1/examples/jsm/postprocessing/UnrealBloomPass.js#L329
  const s = kernelSize;
  const G = (x: number) => (0.39894 * Math.exp((-0.5 * x * x) / s ** 2)) / s;

  const weights = new Array(kernelSize);
  for (let i = 0; i < kernelSize; i++) {
    weights[i] = G(i);
  }

  const ctx = canvas.getContext('2d');
  ensureCanvas2DContext(ctx);

  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const blurredX = ctx.createImageData(width, height);

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      for (let p = 0; p < 4; p++) {
        let weightSum = 0;
        let diffuseSum = 0;
        for (let w = -kernelSize + 1; w < kernelSize; w++) {
          const adjustedX = (x + w) * 4 + p;
          const weight = weights[Math.abs(w)];
          weightSum += weight;
          if (adjustedX < 0 || adjustedX >= width * 4) continue;
          const diffuse = imageData.data[adjustedX + y * width * 4];
          diffuseSum += weight * diffuse;
        }

        blurredX.data[x * 4 + p + y * width * 4] = diffuseSum / weightSum;
      }
    }
  }

  const blurredY = ctx.createImageData(width, height);

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      for (let p = 0; p < 4; p++) {
        let weightSum = 0;
        let diffuseSum = 0;
        for (let w = -kernelSize + 1; w < kernelSize; w++) {
          if (y + w < 0 || y + w >= height) continue;
          const weight = weights[Math.abs(w)];
          const diffuse = blurredX.data[(y + w) * width * 4 + x * 4 + p];
          weightSum += weight;
          diffuseSum += weight * diffuse;
        }

        blurredY.data[x * 4 + p + y * width * 4] = diffuseSum / weightSum;
      }
    }
  }

  return doWorkOffscreen(width, height, (ctx) => {
    ctx.putImageData(blurredY, 0, 0);
  });
}
