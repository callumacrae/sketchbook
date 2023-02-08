import { doWorkOffscreen } from './utils';

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
  if (
    !(ctx instanceof CanvasRenderingContext2D) &&
    !(ctx instanceof OffscreenCanvasRenderingContext2D)
  ) {
    throw new Error('???');
  }

  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const newImageData = ctx.createImageData(width, height);

  for (let x = 0; x < width * 4; x++) {
    for (let y = 0; y < height; y++) {
      let weightSum = 0;
      let diffuseSum = 0;
      for (let w = -kernelSize + 1; w < kernelSize; w++) {
        if (x + w < 0 || x + w >= width * 4) continue;
        const weight = weights[Math.abs(w)];
        const diffuse = imageData.data[(x + w + y * width) * 4];
        weightSum += weight;
        diffuseSum += weight * diffuse;
      }

      newImageData.data[(x + y * width) * 4] = diffuseSum / weightSum;
    }
  }

  return doWorkOffscreen(width, height, (ctx) => {
    ctx.putImageData(newImageData, 0, 0);
  });
}
