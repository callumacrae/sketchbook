<script lang="ts" setup>
import { computed } from 'vue';

const props = defineProps<{
  href?: string;
  onClick?: () => void;
  icon: string;
}>();

const brandMap: { [key: string]: string } = {
  github: 'GitHub',
  codepen: 'CodePen',
  twitter: 'Twitter',
  shadertoy: 'Shadertoy',
};

const title = computed(() => {
  if (props.icon === 'circle-left') return 'Go back';

  const brand = props.icon in brandMap ? brandMap[props.icon] : props.icon;
  return `View on ${brand}`;
});
</script>

<template>
  <component
    v-if="href || onClick"
    :is="href ? 'a' : 'button'"
    :href="href"
    @click="onClick"
    target="_blank"
    :title="title"
    class="shrink-0 grayscale hover:grayscale-0 transition hover:scale-110"
  >
    <span aria-hidden="true">
      <img
        v-if="icon === 'shadertoy'"
        src="/icon-shadertoy-57.png"
        :alt="title"
      />
      <span
        v-else
        :class="`icon-${icon} leading-none block w-full h-full`"
      ></span>
    </span>
    <p class="sr-only">{{ title }}</p>
  </component>
</template>
