import { defineComponent, h } from 'vue';

import { toVanillaCanvas } from './vanilla';
import type { Config, InitFn, FrameFn } from './vanilla';

export function toCanvasComponent<
  CanvasState = undefined,
  SketchConfig = undefined
>(
  init: InitFn<CanvasState, SketchConfig>,
  frame: FrameFn<CanvasState, SketchConfig>,
  sketchbookConfig: Partial<Config<CanvasState, SketchConfig>> = {}
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
    data: () => ({ mouseover: false }),
    render() {
      return h(
        'div',
        {
          class: [
            this.preview ? 'w-full h-full' : 'w-screen h-screen',
            'overflow-hidden flex items-center justify-center',
          ],
        },
        h('canvas', { ref: 'canvas', class: 'bg-white shadow-2xl' })
      );
    },
    async mounted() {
      const canvas = this.$refs.canvas as HTMLCanvasElement | null;
      const config = { ...sketchbookConfig, preview: this.preview };
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
        SketchConfig
      >(canvas, init, frameWithSpy, config);

      this.$options.teardown = teardown;
      this.$options.updateConfig = updateConfig;

      // TODO: Find a less hacky way to pass this to HMR handling
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      window.__sketch_canvasData = data;
    },
    watch: {
      animatingOverride(animate) {
        if (animate !== undefined) {
          this.$options.updateConfig({ animate: animate === 'true' });
        }
      },
    },
    unmounted() {
      if (this.$options.teardown) {
        this.$options.teardown();
      }
    },
  });
}
