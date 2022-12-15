type Coord = [number, number];

interface Options {
  width: number;
  height: number;
  scaleFactor?: number;
  threshold?: number;
  noise: (x: number, y: number) => number;
}

// WARNING: THIS IS ONE OF THE MOST INEFFICIENT THINGS I HAVE EVER WRITTEN
function simplexDistribution({
  width: canvasWidth,
  height: canvasHeight,
  scaleFactor = 1 / 80,
  threshold = 0.4,
  noise,
}: Options) {
  let maxLoops = 1e6;
  const abortLoop = (msg?: string) => {
    if (maxLoops-- < 1) {
      console.error('ABORTING PROBABLE INFINITE LOOP', msg);
      return true;
    }
    return false;
  };

  const width = 6;
  const height = 6;

  const hotspots: Coord[][] = [];

  const isHotspot = (x: number, y: number) =>
    noise(x * scaleFactor, y * scaleFactor) > threshold;

  for (let x = 0; x < canvasWidth; x += width) {
    for (let y = 0; y < canvasHeight; y += height) {
      if (abortLoop('out hotspot loop')) return;

      if (isHotspot(x, y)) {
        // Check if already in another hotspot - if so, abort
        // @todo room for optimisation again - can skip to end of hotspot
        const alreadyGrouped = hotspots.some((hotspot) =>
          hotspot.find(
            (toSearchItem) => toSearchItem[0] === x && toSearchItem[1] === y
          )
        );

        if (alreadyGrouped) {
          continue;
        }

        const hotspot: Coord[] = [[x, y]];
        const toSearch: Coord[] = [
          [x + width, y],
          [x, y + height],
        ];

        // Heads up, toSearch.length changes mid-loop
        for (let i = 0; i < toSearch.length; i++) {
          if (abortLoop('in hotspot loop')) return;

          const search = toSearch[i];

          if (isHotspot(search[0], search[1])) {
            hotspot.push(search);

            const maybeAdd = (searchNext: Coord) => {
              // @todo room for optimisation here - use a data structure that
              // we can do .includes() on or something
              if (
                !toSearch.find(
                  (toSearchItem) =>
                    toSearchItem[0] === searchNext[0] &&
                    toSearchItem[1] === searchNext[1]
                )
              ) {
                toSearch.push(searchNext);
              }
            };

            maybeAdd([search[0] + width, search[1]]);
            maybeAdd([search[0] - width, search[1]]);
            maybeAdd([search[0], search[1] + height]);
            maybeAdd([search[0], search[1] - height]);
          }
        }

        hotspots.push(hotspot);
      }
    }
  }

  return hotspots.map((hotspot) => {
    const size = hotspot.length;
    const brightestSpot = hotspot.reduce(
      (brightest, point) => {
        const [x, y] = point;
        // @todo not optimised - duplicate calculation
        const value = noise(x * scaleFactor, y * scaleFactor);

        if (value > brightest.value) {
          return { value, point };
        } else {
          return brightest;
        }
      },
      {
        value: 0,
        point: [0, 0] as Coord,
      }
    );

    const {
      point: [x, y],
    } = brightestSpot;

    return { x, y, value: size, value2: brightestSpot.value };
  });
}

export default simplexDistribution;
