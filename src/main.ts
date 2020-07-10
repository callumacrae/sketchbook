import Vue from 'vue';
import App from './App.vue';
import router from './router';

// @ts-ignore
import GlobalEvents from 'vue-global-events';

import 'normalize.css/normalize.css';

Vue.config.productionTip = false;

Vue.component('GlobalEvents', GlobalEvents);

new Vue({
  router,
  render: h => h(App)
}).$mount('#app');
