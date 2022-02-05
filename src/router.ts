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
  ],
});

export default router;
