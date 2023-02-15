export type WorkFn = (
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
) => void;

export function doWorkOffscreen(width: number, height: number, workFn: WorkFn) {
  const useOffscreenCanvas = typeof OffscreenCanvas !== 'undefined';

  let canvas;
  if (useOffscreenCanvas) {
    canvas = new OffscreenCanvas(width, height);
  } else {
    canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
  }

  const ctx = canvas.getContext('2d');
  ensureCanvas2DContext(ctx);

  workFn(ctx);

  return canvas;
}

export function ensureCanvas2DContext(
  ctx: any
): asserts ctx is CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D {
  if (
    !(
      typeof CanvasRenderingContext2D !== 'undefined' &&
      ctx instanceof CanvasRenderingContext2D
    ) &&
    !(ctx instanceof OffscreenCanvasRenderingContext2D)
  ) {
    throw new Error('Canvas context is not 2D');
  }
}
