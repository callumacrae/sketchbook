import { createRouter, createWebHistory } from 'vue-router';
import { shaderToyComponent } from '@/utils/renderers/shader-toy';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('./views/Index.vue'),
    },
    {
      path: '/hello-world',
      name: 'Hello World',
      component: () => import('./sketches/hello-world'),
    },
    {
      path: '/line-shapes',
      name: 'Line shapes',
      component: () => import('./sketches/line-shapes'),
    },
    {
      path: '/storm-chars',
      name: 'Storm chars',
      component: () => import('./sketches/storm-chars'),
    },
    {
      path: '/golden-hour',
      name: 'Golden hour',
      component: () => import('./sketches/golden-hour'),
    },
    {
      path: '/hello-world-threejs',
      name: 'Hello world (threejs)',
      component: () => import('./sketches/hello-world-threejs'),
    },
    {
      path: '/brain-storm',
      name: 'Brain storm',
      component: () => import('./sketches/brain-storm'),
      meta: { favourite: true },
    },
    {
      path: '/exploding-text-3d',
      name: '3D exploding text',
      component: () => import('./sketches/exploding-text-3d'),
      meta: { favourite: true },
    },
    {
      path: '/extend-material',
      name: 'three-extend-material',
      component: () => import('./sketches/extend-material'),
    },
    {
      path: '/perspective-lines-glsl',
      name: 'Perspective lines (glsl)',
      component: async () =>
        shaderToyComponent(
          (await import('./sketches/perspective-lines.glsl?raw')).default
        ),
    },
    {
      path: '/anti-aliased-circle',
      name: 'Anti-aliased circle (glsl)',
      component: async () =>
        shaderToyComponent(
          (await import('./sketches/anti-aliased-circle.glsl?raw')).default
        ),
    },
    {
      path: '/circle-sphere',
      name: 'Circle sphere (glsl)',
      component: async () =>
        shaderToyComponent(
          (await import('./sketches/circle-sphere.glsl?raw')).default
        ),
      meta: { favourite: true },
    },
    {
      path: '/line-shape-grid',
      name: 'Line shape grid',
      component: () => import('./sketches/line-shape-grid'),
    },
    {
      path: '/rolling-sphere',
      name: 'Rolling sphere (#genuary day 1)',
      component: () => import('./sketches/rolling-sphere'),
    },
  ],
});

export default router;
