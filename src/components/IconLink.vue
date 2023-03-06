<script lang="ts" setup>
import { computed } from 'vue';

const props = defineProps<{
  href?: string;
  icon: string;
}>();

const brandMap: { [key: string]: string } = {
  github: 'GitHub',
  codepen: 'CodePen',
  twitter: 'Twitter',
  shadertoy: 'Shadertoy',
};

const title = computed(() => {
  const brand = props.icon in brandMap ? brandMap[props.icon] : props.icon;
  return `View on ${brand}`;
});
</script>

<template>
  <a v-if="href" :href="href" target="_blank" :title="title">
    <span
      class="block w-5 h-5 grayscale hover:grayscale-0 transition hover:scale-110"
      aria-hidden="true"
    >
      <slot>
        <span
          :class="`icon-${icon} text-xl leading-none block w-full h-full`"
        ></span>
      </slot>
    </span>
    <p class="sr-only">{{ title }}</p>
  </a>
</template>
