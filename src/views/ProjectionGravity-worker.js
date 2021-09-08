import { contours as d3Contours } from 'd3-contour';
import * as perf from '../utils/perf';

self.onmessage = msg => {
  perf.start('worker task');
  const {
    data: dataBuffer,
    inWidth: n,
    inHeight: m,
    config,
    outWidth,
    outHeight
  } = msg.data;

  const data = new Uint8ClampedArray(dataBuffer);

  const values = new Float64Array(n * m);

  for (let j = 0, k = 0; j < m; ++j) {
    for (let i = 0; i < n; ++i, ++k) {
      values[k] = (data[k * 4] + data[k * 4 + 1] + data[k * 4 + 2]) / 3 / 255;
    }
  }

  const contours = d3Contours()
    .size([n, m])
    .contour(values, config.edgeThreshold);

  const x1 = n * config.transforms.x1;
  const y1 = m * config.transforms.y1;
  const x2 = n * config.transforms.x2;
  const y2 = m * config.transforms.y2;
  const x3 = n * config.transforms.x3;
  const y3 = m * config.transforms.y3;
  const x4 = n * config.transforms.x4;
  const y4 = m * config.transforms.y4;

  const transformPoint = ([xIn, yIn]) => {
    const u1 = (xIn - x1) / (x2 - x1); // rename to uTop
    const u2 = (xIn - x3) / (x4 - x3); // uBottom
    const v1 = (yIn - y1) / (y3 - y1); // vLeft
    const v2 = (yIn - y2) / (y4 - y2); // vRight

    // I got these by solving simultaneous equations on paper lol
    const det = 1 - (u1 - u2) * (v1 - v2);
    const uOut = (u1 + v1 * (u2 - u1)) / det;
    const vOut = (v1 + u2 * (v2 - v1)) / det;

    return [uOut, vOut];
  };

  const platforms = [];

  for (let coords of contours.coordinates) {
    for (let contour of coords) {
      const vertices = contour.map(point => {
        const transformedPoint = transformPoint(point);

        return {
          x: transformedPoint[0] * outWidth,
          y: transformedPoint[1] * outHeight
        };
      });

      const [minX, minY] = vertices.reduce(
        ([minX, minY], { x, y }) => {
          return [Math.min(minX, x), Math.min(minY, y)];
        },
        [vertices[0].x, vertices[0].y]
      );

      // It sometimes returns the outside of the image or something
      // Gets filtered out in next step any, better not to send it at all
      if (minX === 0 && minY === 0) {
        continue;
      }

      platforms.push({ vertices, minX, minY });
    }
  }

  self.postMessage(platforms);
  perf.end('worker task');
};
