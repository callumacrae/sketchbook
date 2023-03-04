import type { Plugin as VitePlugin } from 'vite';

export default function sketchbookPlugin(): VitePlugin {
  return {
    name: 'callumacrae-sketchbook-plugin',

    enforce: 'pre',

    transform(code, id) {
      if (!id.includes('/sketches')) return null;

      if (id.endsWith('.ts')) {
        if (
          code.includes('toCanvasComponent') ||
          !code.includes('CanvasState') ||
          !code.includes('sketchbookConfig')
        )
          return null;

        return {
          code: `
            import { toCanvasComponent } from '@/utils/renderers/vue';

            ${code}

            const component = toCanvasComponent<CanvasState, SketchConfig>(
              init,
              frame,
              sketchbookConfig
            );
            export default component;

            if (import.meta.hot) {
              import.meta.hot.accept((newModule) => {
                window.__sketch_canvasData.frameFn = newModule.frame;
                window.__sketch_canvasData.hasChanged = true;
              });
            }
          `,
          map: null,
        };
      }

      if (id.endsWith('.glsl')) {
        return {
          code: `
            import { shaderToyComponent } from '@/utils/renderers/shader-toy';

            export const glsl = \`${code}\`;

            export default shaderToyComponent(\`${code}\`);

            if (import.meta.hot) {
              import.meta.hot.accept((newModule) => {
                window.__sketch_glsl = newModule.glsl;
              });
            }
          `,
          map: null,
        };
      }

      return null;
    },
  };
}
