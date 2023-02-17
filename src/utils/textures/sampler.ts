const imageCache: Record<string, CanvasRenderingContext2D> = {};

async function fetchImage(imagePath: string) {
  if (imageCache[imagePath]) {
    const cached = imageCache[imagePath];
    return {
      ctx: cached,
      width: cached.canvas.width,
      height: cached.canvas.height,
    };
  }

  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = imagePath;
  });

  const width = img.width;
  const height = img.height;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('no context');
  }
  ctx.drawImage(img, 0, 0);

  imageCache[imagePath] = ctx;

  return { ctx, width, height };
}

export async function pixelateImage(
  imagePath: string,
  cols: number,
  rows: number
) {
  const { ctx, width, height } = await fetchImage(imagePath);
  const sw = width / cols;
  const sh = height / rows;

  const pixels = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const d = ctx.getImageData(x * sw, y * sh, sw, sh);
      pixels.push(...averageOfData(d));
    }
  }

  return pixels;
}

function averageOfData(d: ImageData) {
  let r = 0;
  let g = 0;
  let b = 0;

  // alpha channel ignored for now
  for (let i = 0; i < d.data.length; i += 4) {
    r += d.data[i];
    g += d.data[i + 1];
    b += d.data[i + 2];
  }

  const pixels = d.data.length / 4;
  return [r / pixels, g / pixels, b / pixels, 1];
}

// Skypack doesn't like it when there isn't a default export
export default {};
