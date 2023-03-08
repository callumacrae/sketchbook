import dayjs from 'dayjs';

export interface Sketch {
  name: string;
  date: dayjs.Dayjs;
  favourite?: boolean;
  shadertoy?: string;
  twitter?: string;
  codepen?: string;
  github?: string;
  tags: string[];
  moduleText: string;
  [key: string]: any;
}
export interface SketchWithPath extends Sketch {
  filePath: string;
  path: string;
}

export function isSketch(sketch: any): sketch is Sketch {
  return (
    !!sketch.name &&
    !!dayjs.isDayjs(sketch.date) &&
    !!Array.isArray(sketch.tags) &&
    !!sketch.moduleText
  );
}
export function isSketchWithPath(sketch: any): sketch is SketchWithPath {
  return isSketch(sketch) && !!sketch.filePath && !!sketch.path;
}
export function assertIsSketch(sketch: any): asserts sketch is Sketch {
  if (!isSketch(sketch)) {
    throw new Error('Invalid sketch');
  }
}
export function assertIsSketchWithPath(
  sketch: any
): asserts sketch is SketchWithPath {
  if (!isSketchWithPath(sketch)) {
    throw new Error('Invalid sketch with path');
  }
}

export default function parseSketchMeta(moduleText: string): Sketch | undefined;
export default function parseSketchMeta(
  moduleText: string,
  filePath: string
): SketchWithPath | undefined;
export default function parseSketchMeta(
  moduleText: string,
  filePath?: string
): Sketch | undefined {
  const sketch: Partial<Sketch> = {
    filePath,
    tags: [],
    moduleText,
  };
  if (filePath) {
    sketch.path = '/' + filePath.split('/').pop()?.split('.').shift();
  }

  let jsMeta = moduleText.indexOf('const meta =');
  if (jsMeta === -1) {
    jsMeta = moduleText.indexOf('const _meta =');
  }
  if (jsMeta !== -1) {
    const metaStart = moduleText.indexOf('{', jsMeta);
    const metaEnd = moduleText.indexOf(';', jsMeta);

    const meta: Record<string, any> = eval(
      `(${moduleText.slice(metaStart, metaEnd)})`
    );
    Object.assign(sketch, meta);
  }

  const glslMeta = moduleText.indexOf('// name:');
  if (glslMeta !== -1) {
    const metaEnd = moduleText.indexOf('\n\n', glslMeta);
    const metaText = moduleText.slice(glslMeta, metaEnd).split('\n');

    for (const line of metaText) {
      const colonIndex = line.indexOf(':');
      const key = line.slice(3, colonIndex);
      const value = line.slice(colonIndex + 1).trim();
      if (key === 'tags') {
        sketch[key] = value.split(',').map((tag) => tag.trim());
      } else {
        sketch[key] = value;
      }
    }
  }

  if (jsMeta === -1 && glslMeta === -1) {
    return undefined;
  }

  if (!sketch.date)
    throw new Error(`No date found for ${sketch.name || sketch.path}`);
  sketch.date = dayjs(sketch.date);

  if (filePath) {
    sketch.github = filePath.replace(
      '..',
      'https://github.com/callumacrae/sketchbook/blob/main/src'
    );
  }

  assertIsSketch(sketch);
  return sketch;
}
