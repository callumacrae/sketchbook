<template>
  <router-view />
</template>

<style>
@import '/icomoon/style.css';

@tailwind base;
@tailwind components;
@tailwind utilities;

@font-face {
  font-family: 'Shantell Sans';
  src: url('/shantell-sans/Shantell_Sans-Normal-Medium.woff2') format('woff2');
  font-weight: medium;
  font-style: normal;
  font-display: swap;
}
.sketch canvas {
  background-color: white;
  box-shadow: -5px 10px 10px 0px rgba(0, 0, 0, 0.15);
}

/* Tweak tweakpane widths */
.tp-lblv:not(.tp-lblv-nol) .tp-lblv_v {
  width: 50% !important;
}
@media screen and (min-width: 640px) {
  .tp-dfwv {
    min-width: 300px;
  }
}
</style>
