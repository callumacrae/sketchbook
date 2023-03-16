import { createApp } from 'vue';
import { createHead } from "@vueuse/head"
import dayjs from 'dayjs';
import advancedFormat from 'dayjs/plugin/advancedFormat';

import App from './App.vue';
import router from './router';

dayjs.extend(advancedFormat);

const app = createApp(App);

app.use(router);
app.use(createHead());

app.mount('#app');
