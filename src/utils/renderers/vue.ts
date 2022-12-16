import { defineComponent, h } from 'vue';

import { toVanillaCanvas } from './vanilla';
import type { Config, InitFn, FrameFn } from './vanilla';

export function toCanvasComponent<
  CanvasState = undefined,
  SketchConfig = undefined
>(
  init: InitFn<CanvasState, SketchConfig>,
  frame: FrameFn<CanvasState, SketchConfig>,
  sketchbookConfig: Partial<Config<SketchConfig>> = {}
) {
  return defineComponent({
    render: () => h('canvas', { ref: 'canvas' }),
    async mounted() {
      const canvas = this.$refs.canvas as HTMLCanvasElement | null;
      const { teardown } = await toVanillaCanvas<CanvasState, SketchConfig>(
        canvas,
        init,
        frame,
        sketchbookConfig
      );

      this.$options.teardown = teardown;
    },
    unmounted() {
      if (this.$options.teardown) {
        this.$options.teardown();
      }
    },
  });
}
