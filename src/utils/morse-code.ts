export default function getMorseCoder(pattern: string) {
  const splitPattern = pattern
    .replace(/ +/g, ' ')
    .replace(/\s*\/\s*/g, '/')
    .split('');
  const timings: { start: number; end: number; on: boolean }[] = [];

  let totalTime = 0;
  let previousChar = '';

  for (const char of splitPattern) {
    if (char === '.' || char === '-') {
      if (previousChar === '.' || previousChar === '-') {
        timings.push({
          start: totalTime,
          end: (totalTime += 1000),
          on: false,
        });
      }
      timings.push({
        start: totalTime,
        end: (totalTime += char === '.' ? 1000 : 3000),
        on: true,
      });
    } else if (char === ' ' || char === '/') {
      timings.push({
        start: totalTime,
        end: (totalTime += char === ' ' ? 2000 : 7000),
        on: false,
      });
    }

    previousChar = char;
  }

  timings.push({
    start: totalTime,
    end: (totalTime += 7000),
    on: false,
  });

  console.log(totalTime);
  return {
    at(time: number) {
      const normalisedTime = time % totalTime;
      const timingSegment = timings.find(
        ({ start, end }) => start < normalisedTime && end >= normalisedTime
      );
      return timingSegment?.on || false;
    },
  };
}
