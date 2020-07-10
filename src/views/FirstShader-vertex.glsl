precision mediump float;
attribute vec2 a_position;
varying vec2 vUv;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  vUv = gl_Position.xy * 0.5 + 0.5;
}
