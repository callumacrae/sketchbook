import { fileURLToPath, URL } from 'url';

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

import sketchbookPlugin from './vite/sketch-plugin';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), sketchbookPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
