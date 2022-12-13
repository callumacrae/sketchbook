import { createRouter, createWebHistory } from 'vue-router';

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
  ],
});

export default router;
