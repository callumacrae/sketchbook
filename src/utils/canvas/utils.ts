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

  // This is to keep typescript happy 🤷‍♂️
  if (
    !ctx ||
    !(
      ctx instanceof CanvasRenderingContext2D ||
      ctx instanceof OffscreenCanvasRenderingContext2D
    )
  ) {
    throw new Error('Something went wrong');
  }

  workFn(ctx);

  return canvas;
}
