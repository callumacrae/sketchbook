import Vue from 'vue';
import VueRouter, { RouteConfig } from 'vue-router';

Vue.use(VueRouter);

const routes: Array<RouteConfig> = [
  {
    path: '/animated-blobs',
    name: 'Contour texture v1',
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
    path: '/light-tracing',
    name: 'Light tracing',
    component: () => import('../views/LightTracing.vue'),
    meta: {
      link: 'https://twitter.com/callumacrae/status/1272626085365264387'
    }
  },
  {
    path: '/contour-texture',
    name: 'Contour texture v2',
    component: () => import('../views/ContourTexture.vue')
  },
  {
    path: '/animated-cow',
    name: 'Shitty animated cow',
    component: () => import('../views/AnimatedCow.vue')
  },
  {
    path: '/3d-cube',
    name: 'Contour texture on cube',
    component: () => import('../views/3dCube.vue'),
    meta: {
      favourite: true
    }
  },
  {
    path: '/moving-light',
    name: 'Plant projection mapping',
    component: () => import('../views/MovingLight.vue'),
    meta: {
      link: 'https://twitter.com/callumacrae/status/1279855080523563009'
    }
  },
  {
    path: '/exploding-text',
    name: 'Exploding text',
    component: () => import('../views/ExplodingText.vue'),
    meta: {
      favourite: true,
      link: 'https://codepen.io/callumacrae/full/GRodzvO'
    }
  },
  {
    path: '/normal-lines',
    name: 'Normal lines',
    component: () => import('../views/NormalLines.vue'),
    meta: {
      favourite: true,
      link: 'https://codepen.io/callumacrae/full/RwRmgog'
    }
  },
  {
    path: '/first-shader',
    name: 'First shader',
    component: () => import('../views/FirstShader.vue')
  },
  {
    path: '/hazy-mountains',
    name: 'Hazy mountains',
    component: () => import('../views/HazyMountains.vue')
  },
  {
    path: '/perspective-lines',
    name: 'Perspective lines',
    component: () => import('../views/PerspectiveLines.vue')
  },
  {
    path: '/moire-grid',
    name: 'Moiré grid',
    component: () => import('../views/MoireGrid.vue')
  },
  {
    path: '/connected-components',
    name: 'Connected components',
    component: () => import('../views/ConnectedComponents.vue')
  },
  {
    path: '/warped-grid',
    name: 'Warped grid',
    component: () => import('../views/WarpedGrid.vue')
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
