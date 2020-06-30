import Vue from 'vue';
import VueRouter, { RouteConfig } from 'vue-router';

Vue.use(VueRouter);

const routes: Array<RouteConfig> = [
  {
    path: '/animated-blobs',
    component: () =>
      import(
        /* webpackChunkName: "animated-blobs" */ '../views/AnimatedBlobs.vue'
      )
  },
  {
    path: '/triangles',
    component: () =>
      import(/* webpackChunkName: "triangles" */ '../views/Triangles.vue')
  },
  {
    path: '/simplex-lines',
    component: () =>
      import(
        /* webpackChunkName: "simplex-lines" */ '../views/SimplexLines.vue'
      )
  },
  {
    path: '/3d-cube',
    component: () => import('../views/3dCube.vue')
  },
  {
    path: '/light-tracing',
    component: () => import('../views/LightTracing.vue')
  }
];

const router = new VueRouter({
  mode: 'history',
  base: process.env.BASE_URL,
  routes
});

export default router;
