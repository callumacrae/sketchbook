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

        const githubLink = id.replace(
          /^.*\/sketches\/(.*)$/,
          'https://github.com/callumacrae/sketchbook/blob/main/src/sketches/$1'
        );
        return {
          code: `
            import { toCanvasComponent } from '@/utils/renderers/vue';
            import SketchLinks from '@/components/SketchLinks.vue';

            ${code}

            const component = toCanvasComponent<CanvasState, SketchConfig>(
              init,
              frame,
              sketchbookConfig,
              {
                component: SketchLinks,
                meta: { github: '${githubLink}', ...(meta ?? _meta) },
              },
            );
            export default component;

            if (import.meta.hot) {
              import.meta.hot.accept((newModule) => {
                if (window.__sketch_canvasData) {
                  window.__sketch_canvasData.frameFn = newModule.frame;
                  window.__sketch_canvasData.hasChanged = true;
                }
              });
            }
          `,
          map: null,
        };
      }

      if (id.endsWith('.glsl')) {
        const filePath = id.replace(/^.*\/sketches\//, '../sketches/');

        return {
          code: `
            import { shaderToyComponent } from '@/utils/renderers/shader-toy';
            import SketchLinks from '@/components/SketchLinks.vue';

            export const glsl = \`${code}\`;

            export default shaderToyComponent(\`${code}\`, '${filePath}', SketchLinks);

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
