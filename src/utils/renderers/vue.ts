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
    render: () => h('canvas', { ref: 'canvas', id: 'sketch' }),
    async mounted() {
      const canvas = this.$refs.canvas as HTMLCanvasElement | null;
      const { teardown, data } = await toVanillaCanvas<
        CanvasState,
        SketchConfig
      >(canvas, init, frame, sketchbookConfig);

      this.$options.teardown = teardown;

      // TODO: Find a less hacky way to pass this to HMR handling
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      window.__sketch_canvasData = data;
    },
    unmounted() {
      if (this.$options.teardown) {
        this.$options.teardown();
      }
    },
  });
}
