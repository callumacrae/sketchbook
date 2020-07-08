<template>
  <div class="main">
    <div class="index">
      <h1>Sketches</h1>

      <ul>
        <li v-for="route in routes" :key="route.path">
          <i v-if="route.meta && route.meta.favourite" class="fav-icon">⭐️</i>
          <router-link
            :to="route.path"
            @mouseover.native="previewUrl = route.path"
            >{{ route.name || route.path }}</router-link
          >
        </li>
      </ul>
    </div>

    <iframe class="preview" :src="previewUrl"></iframe>
  </div>
</template>

<script>
export default {
  data: () => ({
    previewUrl: undefined
  }),
  computed: {
    routes() {
      return this.$router.options.routes.filter(route => route.path !== '*');
    }
  }
};
</script>

<style scoped>
.main {
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;

  font-family: sans-serif;
}

.index {
  margin-right: 100px;
}

h1 {
  margin-top: 0;
}

li {
  margin: 1em 0;
}

li:last-child {
  margin-bottom: 0;
}

.fav-icon {
  font-style: normal;
}

.preview {
  width: 50vw;
  height: calc(50vw / 16 * 9);

  border: 1px hsl(0, 0%, 80%) solid;
}
</style>
