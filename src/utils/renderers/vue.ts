import { defineComponent, h } from 'vue';
import type { Component } from 'vue';

import { toVanillaCanvas } from './vanilla';
import type { SketchConfig, InitFn, FrameFn } from './vanilla';
import type { Sketch } from '../sketch-parsing';

export function toCanvasComponent<
  CanvasState = undefined,
  UserConfig = undefined
>(
  init: InitFn<CanvasState, UserConfig>,
  frame: FrameFn<CanvasState, UserConfig>,
  sketchConfig: Partial<SketchConfig<CanvasState, UserConfig>> = {},
  metaLinks?: { meta?: Sketch; component: Component }
) {
  return defineComponent({
    props: {
      preview: {
        type: Boolean,
        default: false,
      },
      animatingOverride: {
        type: String,
        default: undefined,
      },
    },
    data: () => ({ mouseover: false, meta: metaLinks?.meta }),
    render() {
      return h(
        'div',
        {
          class: [
            this.preview ? 'w-full h-full' : 'w-screen h-screen',
            'overflow-hidden flex items-center justify-center',
          ],
        },
        [
          h('canvas', { ref: 'canvas', class: 'bg-white shadow-2xl' }),
          this.preview || !metaLinks?.meta
            ? null
            : h(
                'div',
                {
                  class:
                    'absolute top-2 left-2 p-1.5 flex gap-2 text-xl md:text-2xl bg-zinc-300 rounded-full opacity-60 hover:opacity-100 transition-opacity',
                },
                h(metaLinks.component, { sketch: this.meta, size: 'medium' })
              ),
        ]
      );
    },
    async mounted() {
      const canvas = this.$refs.canvas as HTMLCanvasElement | null;
      const config = { ...sketchConfig, isPreview: this.preview };
      if (this.preview) {
        delete config.width;
        delete config.height;
      }
      if (this.animatingOverride !== undefined) {
        config.animate = this.animatingOverride === 'true';
      }
      const frameWithSpy: typeof frame = (...args) => {
        this.$emit('frame');
        frame(...args);
      };
      const { teardown, data, updateConfig } = await toVanillaCanvas<
        CanvasState,
        UserConfig
      >(canvas, init, frameWithSpy, config);

      this.$options.teardown = teardown;
      this.$options.updateConfig = updateConfig;

      if (!this.preview) {
        // TODO: Find a less hacky way to pass this to HMR handling
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        window.__sketch_canvasData = data;
      }
    },
    watch: {
      animatingOverride(animate) {
        if (animate !== undefined) {
          this.$options.updateConfig({ animate: animate === 'true' });
        }
      },
    },
    beforeUnmount() {
      if (this.$options.teardown) {
        this.$options.teardown();
      }

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      delete window.__sketch_canvasData;
    },
  });
}
