<template>
  <div class="main">
    <div class="index">
      <ul>
        <li v-for="route in routes" :key="route.path">
          <i v-if="route.meta && route.meta.favourite" class="fav-icon">⭐️</i>
          <router-link
            :to="route.path"
            @mouseover.native="previewRoute(route)"
            >{{ route.name || route.path }}</router-link
          >
        </li>
      </ul>
    </div>

    <div
      class="preview"
      :class="{ 'preview--has-link': preview.meta && preview.meta.link }"
      @transitionend="handleTransitionEnd"
    >
      <h1>Sketches</h1>
      <p>
        Disclaimer: this is called sketchbook for a reason - this is public to
        demonstrate my learning process, not my ability. A lot of this stuff is
        very bad!
      </p>

      <!-- Added to the DOM even when empty for the transition -->
      <a :href="previewLink" target="_blank">{{ previewLink }}</a>
      <iframe :src="preview.path"></iframe>
    </div>
  </div>
</template>

<script>
export default {
  data: () => ({
    preview: {},
    previewLink: undefined
  }),
  computed: {
    routes() {
      return this.$router.options.routes.filter(route => route.path !== '*');
    }
  },
  methods: {
    previewRoute(route) {
      this.preview = route;

      if (route.meta && route.meta.link) {
        this.previewLink = route.meta.link;
      }
    },
    handleTransitionEnd() {
      if (this.previewLink && !(this.preview.meta && this.preview.meta.link)) {
        this.previewLink = undefined;
      }
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
  position: relative;

  width: 50vw;
}

.preview iframe {
  width: 50vw;
  height: calc(50vw / 16 * 9);
  margin-top: 2em;

  background-color: white;
  border: 1px hsl(0, 0%, 80%) solid;
  transition: transform 400ms;
}

.preview a {
  position: absolute;
  top: 100%;
  transform: translateY(-25px);
  transition: transform 400ms;

  display: block;
  width: 100%;

  text-align: center;
}

.preview--has-link iframe {
  transform: translateY(-12.5px);
}

.preview--has-link a {
  transform: translateY(0);
}
</style>
