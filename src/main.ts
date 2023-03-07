import { createApp } from 'vue';
import App from './App.vue';
import router from './router';

import dayjs from 'dayjs';
import advancedFormat from 'dayjs/plugin/advancedFormat';

dayjs.extend(advancedFormat);

const app = createApp(App);

app.use(router);

app.mount('#app');
