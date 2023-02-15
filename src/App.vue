<template>
  <router-view />
</template>

<style>
body {
  margin: 0;
  overflow: hidden;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  /* background-color: #b2adb9; */
}

canvas {
  background-color: white;
  box-shadow: -5px 10px 10px 0px rgba(0, 0, 0, 0.15);
}

#sketch:not(.custom-size) {
  width: 100vw;
  height: 100vh;
}

/* Increase tweakpane label width */
.tp-dfwv {
  min-width: 290px;
}
.tp-lblv_v {
  min-width: 110px;
}
</style>
