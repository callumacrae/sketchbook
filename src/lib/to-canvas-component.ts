import { defineComponent, h, UnwrapRef } from 'vue';

export interface InitProps {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
}

export interface FrameProps<T> {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  state: T;
  timestamp: number;
}

export type InitFn<T> = (props: InitProps) => T | Promise<T>;
export type FrameFn<T> = (props: FrameProps<T>) => void;

export default function toCanvasComponent<T = undefined>(
  init: InitFn<T>,
  frame: FrameFn<T>
) {
  return defineComponent({
    render: () => h('canvas', { ref: 'canvas' }),
    data: () => ({
      width: 0,
      height: 0,
      canvasState: {} as T,
      ctx: null as CanvasRenderingContext2D | null,
    }),
    async mounted() {
      const canvas = this.$refs.canvas as HTMLCanvasElement | null;

      if (!canvas) {
        throw new Error('No canvas');
      }

      this.ctx = canvas.getContext('2d');

      if (!this.ctx) {
        throw new Error('No canvas context');
      }

      const dpr = window.devicePixelRatio;
      this.width = canvas.clientWidth * dpr;
      this.height = canvas.clientHeight * dpr;
      canvas.width = this.width;
      canvas.height = this.height;

      const initProps: InitProps = {
        ctx: this.ctx,
        width: this.width,
        height: this.height,
      };

      const state = await Promise.resolve(init(initProps));
      if (state) {
        this.canvasState = state as UnwrapRef<T>;
      }

      this.callFrame(0);
    },
    methods: {
      callFrame(timestamp: number) {
        const { ctx, width, height, canvasState } = this;

        if (!ctx) {
          throw new Error('No canvas context');
        }

        const frameProps: FrameProps<T> = {
          ctx,
          width,
          height,
          state: canvasState as T,
          timestamp,
        };

        frame(frameProps);

        requestAnimationFrame(this.callFrame);
      },
    },
  });
}
