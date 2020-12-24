type Color = [number, number, number, number];

/*
 * Uses two-pass closed-component labelling to fill a the gaps in a canvas
 * with colour (from a callback function).
 *
 * Destroys the original canvas. Redraw any lines on top.
 */
export default function cclFill(
  ctx: CanvasRenderingContext2D,
  getColor: (val: number) => Color
) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const imageData = ctx.getImageData(0, 0, width, height);

  // -1: not hole
  // 0: unlabelled
  // 1+: labels
  // maximum value is 32,767 - @todo check this is ok
  const data = new Int16Array(width * height);

  // Iterate through deciding whether each pixel is a hole or not
  for (let i = 0; i < width * height; i++) {
    data[i] = imageData.data[i * 4 + 3] < 100 ? 0 : -1;
  }

  let nextLabel = 1;
  const equivalent = new Map();

  // Iterate through labelling each hole and adding to equivalent map where
  // appropriate
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;

      if (data[i] === -1) {
        continue;
      }

      const leftLabel = x ? data[i - 1] : -1;
      const aboveLabel = y ? data[i - width] : -1;

      if (leftLabel === -1 && aboveLabel === -1) {
        data[i] = nextLabel;
        nextLabel++;
      } else if (leftLabel === -1) {
        data[i] = aboveLabel;
      } else if (aboveLabel === -1) {
        data[i] = leftLabel;
      } else {
        const label = Math.min(aboveLabel, leftLabel);
        data[i] = label;

        if (aboveLabel !== leftLabel) {
          equivalent.set(
            Math.max(aboveLabel, leftLabel),
            equivalent.get(label) || label
          );
        }
      }
    }
  }

  // Iterate through again removing equivalent labels
  for (let i = 0; i < width * height; i++) {
    const newLabel = equivalent.get(data[i]);
    if (newLabel) {
      data[i] = newLabel;
    }
  }

  // Count the number of pixels in each group
  const groupSizes: { [label: string]: number } = {};
  for (let i = 0; i < width * height; i++) {
    if (!groupSizes[data[i]]) {
      groupSizes[data[i]] = 0;
    }

    groupSizes[data[i]]++;
  }

  const groupSizesFlat = Object.entries(groupSizes)
    .filter(([label]) => label !== '-1')
    .map(([key, value]) => value)
    .sort((a, b) => a - b);

  // const maxGroupSize = Math.max(...groupSizesFlat);
  const maxGroupSize = groupSizesFlat[Math.ceil(groupSizesFlat.length * 0.9)]

  // Calculate colours for each group
  const groupColors: { [label: string]: Color } = {
    '-1': [0, 0, 0, 0]
  };
  for (const [label, value] of Object.entries(groupSizes)) {
    if (label === '-1') {
      continue;
    }

    groupColors[label] = getColor(value / maxGroupSize);
  }

  const newImageData = new Uint8ClampedArray(width * height * 4);

  // Create pixel data for filled canvas
  for (let i = 0; i < data.length; i++) {
    const label = data[i];

    const color = groupColors[label];

    newImageData[i * 4] = color[0];
    newImageData[i * 4 + 1] = color[1];
    newImageData[i * 4 + 2] = color[2];
    newImageData[i * 4 + 3] = color[3];
  }

  return new ImageData(newImageData, width, height);
}
