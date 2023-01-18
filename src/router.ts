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
      meta: {
        favourite: true,
        link: 'https://codepen.io/callumacrae/full/zYLOrWZ',
      },
    },
    {
      path: '/exploding-text-3d',
      name: '3D exploding text',
      component: () => import('./sketches/exploding-text-3d'),
      meta: {
        favourite: true,
        link: 'https://codepen.io/callumacrae/full/VwBLvWN',
      },
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
      meta: { link: 'https://www.shadertoy.com/view/clXGD7' },
    },
    {
      path: '/anti-aliased-circle',
      name: 'Anti-aliased circle (glsl)',
      component: async () =>
        shaderToyComponent(
          (await import('./sketches/anti-aliased-circle.glsl?raw')).default
        ),
      meta: { link: 'https://www.shadertoy.com/view/Dts3zX' },
    },
    {
      path: '/circle-sphere',
      name: 'Circle sphere (glsl)',
      component: async () =>
        shaderToyComponent(
          (await import('./sketches/circle-sphere.glsl?raw')).default
        ),
      meta: { favourite: true, link: 'https://www.shadertoy.com/view/dtX3Dj' },
    },
    {
      path: '/illuminating-shapes',
      name: 'Illuminating shapes',
      component: () => import('./sketches/illuminating-shapes'),
      meta: { favourite: true },
    },
    {
      path: '/rolling-sphere',
      name: 'Rolling sphere (#genuary day 1)',
      component: () => import('./sketches/rolling-sphere'),
      meta: { link: 'https://codepen.io/callumacrae/full/QWBEmVR' },
    },
    {
      path: '/glitch-art',
      name: 'Glitch art (#genuary3) (glsl)',
      component: async () =>
        shaderToyComponent(
          (await import('./sketches/glitch-art.glsl?raw')).default
        ),
      meta: { favourite: true },
    },
    {
      path: '/moving-mirrors',
      name: 'Moving mirrors',
      component: () => import('./sketches/moving-mirrors'),
      meta: {
        favourite: true,
        link: 'https://codepen.io/callumacrae/full/qByPVNr',
      },
    },
    {
      path: '/reflecting-light',
      name: 'Reflecting light experiment',
      component: async () =>
        shaderToyComponent(
          (await import('./sketches/reflecting-light.glsl?raw')).default
        ),
    },
    {
      path: '/pickup-sticks',
      name: 'Pick-up sticks',
      component: () => import('./sketches/pickup-sticks'),
    },
  ],
});

export default router;
