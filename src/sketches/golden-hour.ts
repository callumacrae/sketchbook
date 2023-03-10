import type { SketchConfig, InitFn, FrameFn } from '@/utils/renderers/vanilla';

export const meta = {
  name: 'Golden hour',
  date: '2022-12-13',
  tags: ['Canvas 2D'],
};

interface CanvasState {
  bg: HTMLImageElement;
}

const userConfig = {};

type UserConfig = typeof userConfig;

export const sketchConfig: Partial<SketchConfig<CanvasState, UserConfig>> = {
  width: 1080,
  height: 1080,
  userConfig,
};

export const init: InitFn<CanvasState, UserConfig> = async () => {
  const bgImg = new Image();
  await new Promise<void>((resolve) => {
    bgImg.addEventListener('load', () => {
      resolve();
    });
    bgImg.src = '/golden-hour/bg.png';
  });

  return { bg: bgImg };
};

export const frame: FrameFn<CanvasState, UserConfig> = ({
  ctx,
  width,
  height,
  state,
  timestamp,
}) => {
  if (!ctx) throw new Error('???');

  ctx.drawImage(state.bg, 0, 0, width, height);

  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'white';
  ctx.strokeStyle = 'white';

  const name = (main: string, sub: string, y: number) => {
    ctx.beginPath();
    ctx.moveTo(650, y);
    ctx.lineTo(950, y);
    ctx.moveTo(650, y + 110);
    ctx.lineTo(950, y + 110);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.font = 'bold 50px Source Code Pro';
    ctx.fillText(main, 800, y + 50);

    ctx.font = 'bold 24px Source Code Pro';
    ctx.fillText(sub, 800, y + 85);
  };

  const name2 = (main: string, main2: string, sub: string, y: number) => {
    ctx.beginPath();
    ctx.moveTo(650, y);
    ctx.lineTo(950, y);
    ctx.moveTo(650, y + 110);
    ctx.lineTo(950, y + 110);
    ctx.stroke();

    ctx.textAlign = 'right';
    ctx.font = 'bold 50px Source Code Pro';
    ctx.fillText(main, 760, y + 50);
    ctx.textAlign = 'center';
    ctx.font = 'bold 30px Source Code Pro';
    ctx.fillText('b2b', 800, y + 54);
    ctx.textAlign = 'left';
    ctx.font = 'bold 50px Source Code Pro';
    ctx.fillText(main2, 840, y + 50);

    ctx.textAlign = 'center';
    ctx.font = 'bold 24px Source Code Pro';
    ctx.fillText(sub, 800, y + 85);
  };

  // 32 seconds
  const t = Math.round((timestamp / 1000) * 33.75 * 2) % height;

  const start = 150 - t;
  const offset = height / 4;
  name('TALAL', '(RENAISSANCE, BAR25, SPECTRUM)', start);
  name('JORGE MONTIEL', '(IMAGENES RECORDINGS)', start + offset);
  name('SAS', '(FOX AND BADGE, NOISILY)', start + offset * 2);
  name2('DROYMA', 'SOMMEZ', '(GOLDEN HOUR)', start + offset * 3);
  name('TALAL', '(RENAISSANCE, BAR25, SPECTRUM)', start + offset * 4);
  name('JORGE MONTIEL', '(IMAGENES RECORDINGS)', start + offset * 5);
  name('SAS', '(FOX AND BADGE, NOISILY)', start + offset * 6);
  name2('DROYMA', 'SOMMEZ', '(GOLDEN HOUR)', start + offset * 7);
};
