import { createRouter, createWebHistory } from 'vue-router';

const sketchModules = import.meta.glob('./sketches/*.{ts,vue,glsl}');
const sketchRoutes = Object.entries(sketchModules).map(([path, component]) => {
  const name = path.split('/').pop()?.split('.').shift();
  if (!name) throw new Error('???');
  return { path: `/${name}`, component };
});

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('./views/Index.vue'),
    },
    ...sketchRoutes,
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
});

export default router;
