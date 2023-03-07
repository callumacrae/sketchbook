import dayjs from 'dayjs';
import type { Component } from 'vue';

export interface Sketch {
  filePath: string;
  path: string;
  name: string;
  date: dayjs.Dayjs;
  favourite?: boolean;
  shadertoy?: string;
  twitter?: string;
  codepen?: string;
  github: string;
  tags: string[];
  moduleText: string;
  component: Component;
  [key: string]: any;
}

export default function parseSketchMeta(
  filePath: string,
  moduleText: string
): Omit<Sketch, 'component'> | undefined {
  const sketch: Partial<Sketch> = {
    filePath,
    path: '/' + filePath.split('/').pop()?.split('.').shift(),
    tags: [],
    moduleText,
  };

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

  sketch.github = filePath.replace(
    '..',
    'https://github.com/callumacrae/sketchbook/blob/main/src'
  );

  return sketch;
}
