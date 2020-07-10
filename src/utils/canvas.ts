type WorkFn = (
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
) => ImageBitmap | HTMLCanvasElement;

export function doWorkOffscreen(width: number, height: number, workFn: WorkFn) {
  let canvas;
  if (typeof OffscreenCanvas === 'undefined') {
    canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
  } else {
    canvas = new OffscreenCanvas(width, height);
  }

  const ctx = canvas.getContext('2d');

  // This is to keep typescript happy 🤷‍♂️
  if (!ctx) {
    throw new Error('Something went wrong');
  }

  workFn(ctx);

  return canvas instanceof OffscreenCanvas
    ? canvas.transferToImageBitmap()
    : canvas;
}
