import Vue from 'vue';
import VueRouter, { RouteConfig } from 'vue-router';

Vue.use(VueRouter);

const routes: Array<RouteConfig> = [
  {
    path: '/animated-blobs',
    name: 'Animated blobs',
    component: () => import('../views/AnimatedBlobs.vue')
  },
  {
    path: '/triangles',
    name: 'Generative triangles',
    component: () => import('../views/Triangles.vue'),
    meta: {
      favourite: true
    }
  },
  {
    path: '/simplex-lines',
    name: 'Simplex lines',
    component: () => import('../views/SimplexLines.vue')
  },
  {
    path: '/3d-cube',
    name: '3D cube',
    component: () => import('../views/3dCube.vue'),
    meta: {
      favourite: true
    }
  },
  {
    path: '/light-tracing',
    name: 'Light tracing',
    component: () => import('../views/LightTracing.vue')
  },
  {
    path: '/contour-texture',
    name: 'Contour texture',
    component: () => import('../views/ContourTexture.vue')
  },
  {
    path: '/animated-cow',
    name: 'Shitty animated cow',
    component: () => import('../views/AnimatedCow.vue')
  },
  {
    path: '/moving-light',
    name: 'Plant projection mapping',
    component: () => import('../views/MovingLight.vue')
  },
  {
    path: '/exploding-text',
    name: 'Exploding text',
    component: () => import('../views/ExplodingText.vue')
  },
  {
    path: '*',
    component: () => import('../views/Index.vue')
  }
];

const router = new VueRouter({
  mode: 'history',
  base: process.env.BASE_URL,
  routes
});

export default router;
