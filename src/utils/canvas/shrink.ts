import { doWorkOffscreen } from './utils';

export default function shrinkCanvas(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  width: number,
  height: number
) {
  return doWorkOffscreen(width, height, (ctx) => {
    ctx.drawImage(canvas, 0, 0, width, height);
  });
}
