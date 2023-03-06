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
        type: Boolean,
      },
    },
    data: () => ({ mouseover: false }),
    render: () => h('div', { class: 'sketch' }, h('canvas', { ref: 'canvas' })),
    async mounted() {
      const canvas = this.$refs.canvas as HTMLCanvasElement | null;
      const config = { ...sketchbookConfig, preview: this.preview };
      const { teardown, data, updateConfig } = await toVanillaCanvas<
        CanvasState,
        SketchConfig
      >(canvas, init, frame, config);

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
          this.$options.updateConfig({ animate });
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
