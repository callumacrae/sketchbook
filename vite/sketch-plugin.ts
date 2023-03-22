import type { Plugin as VitePlugin } from 'vite';

export default function sketchbookPlugin(): VitePlugin {
  return {
    name: 'callumacrae-sketchbook-plugin',

    enforce: 'pre',

    transform(source, id) {
      if (!id.includes('/sketches')) return null;

      if (id.endsWith('.ts')) {
        if (
          source.includes('toCanvasComponent') ||
          !source.includes('CanvasState') ||
          !source.includes('sketchConfig')
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

            ${source}

            const component = toCanvasComponent<CanvasState, SketchConfig>(
              init,
              frame,
              sketchConfig,
              {
                component: SketchLinks,
                meta: { github: '${githubLink}', ...(meta ?? _meta) },
              },
            );
            export default component;

            let oldUserConfig = JSON.stringify(sketchConfig.userConfig);

            if (import.meta.hot) {
              import.meta.hot.accept((newModule) => {
                const keys = Object.keys(newModule);

                let initChanged = false;
                let hotReloadSuccess = false;

                const initFn = newModule.init.toString();
                const frameFn = newModule.frame.toString();

                for (const key of keys) {
                  if (['default', 'meta'].includes(key)) continue;

                  if (key === 'sketchConfig') {
                    const oldSketchConfig = sketchConfig;
                    const newSketchConfig = newModule.sketchConfig;

                    const oldKeys = Object.keys(oldSketchConfig);
                    const newKeys = Object.keys(newSketchConfig);

                    if (oldKeys.length !== newKeys.length) {
                      window.location.reload();
                    }

                    for (const key of oldKeys) {
                      if (key === 'plugins') {
                        if (oldSketchConfig.plugins.length !== newSketchConfig.plugins.length) {
                          window.location.reload();
                        }
                      } else if (key === 'userConfig' && window.__sketch_canvasData) {
                        const newUserConfig = JSON.stringify(newSketchConfig.userConfig);
                        if (oldUserConfig !== newUserConfig) {
                          Object.assign(
                            window.__sketch_canvasData.sketchConfig.userConfig,
                            newSketchConfig.userConfig
                          );
                          window.__sketch_canvasData.hasChanged = true;
                          oldUserConfig = newUserConfig;

                          const plugins = window.__sketch_canvasData.plugins;

                          for (const plugin of plugins) {
                            if (plugin.name === 'tweakpane') {
                              plugin.refresh();
                            }
                          }

                          hotReloadSuccess = true;
                        }
                      } else {
                        try {
                          if (oldSketchConfig[key].toString() !== newSketchConfig[key].toString()) {
                            window.location.reload();
                          }
                        } catch (err) {
                          console.error(err);
                          window.location.reload();
                        }
                      }
                    }
                  }

                  const isSame = newModule[key].toString() === eval(key)?.toString();
                  if (isSame) continue;

                  if (key === 'init') {
                    initChanged = true;
                  } else if (key === 'frame') {
                    hotReloadSuccess = true;
                  } else {
                    const keyRegex = new RegExp('\\\\b' + key + '\\\\b');
                    const isInInit = keyRegex.test(initFn);
                    if (keyRegex.test(frameFn)) {
                      hotReloadSuccess = true;

                      // If the key is used in init too, check whether it's
                      // handled in a hasChanged block
                      if (isInInit) {
                        const regex = /\\n(\\s*)if\\s*\\([^)]*hasChanged[^)]*\\)\\s*{\\n([\\s\\S]+?)\\n\\1}/gm;
                        const matches = frameFn.matchAll(regex);
                        let handledInHasChanged = false;
                        for (const match of matches) {
                          if (keyRegex.test(match[2])) {
                            handledInHasChanged = true;
                          }
                        }
                        
                        if (!handledInHasChanged) {
                          initChanged = true;
                        }
                      }
                    } else if (isInInit) {
                      initChanged = true;
                    }
                  }
                }

                if (initChanged) {
                  window.location.reload();
                } else if (!hotReloadSuccess) {
                  console.warn('Unable to detect changes: can only detect changes on exported functions and variables');
                }

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

            export const glsl = \`${source}\`;

            export default shaderToyComponent(glsl, '${filePath}', SketchLinks);

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
