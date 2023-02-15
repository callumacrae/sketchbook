import { createRouter, createWebHistory } from 'vue-router';
import { shaderToyComponent } from '@/utils/renderers/shader-toy';

const pathToPath = (path: string) => {
  const name = path.split('/').pop()?.split('.').shift();
  if (!name) throw new Error('???');
  return `/${name}`;
};

const tsModules = import.meta.glob('./sketches/*.{ts,vue}');
const tsRoutes = Object.entries(tsModules).map(([path, component]) => {
  return { path: pathToPath(path), component };
});

const glslModules = import.meta.glob('./sketches/*.glsl', { as: 'raw' });
const glslRoutes = Object.entries(glslModules).map(([path, glsl]) => {
  return {
    path: pathToPath(path),
    component: async () => shaderToyComponent(await glsl()),
  };
});

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('./views/Index.vue'),
    },
    ...tsRoutes,
    ...glslRoutes,
  ],
});

export default router;
