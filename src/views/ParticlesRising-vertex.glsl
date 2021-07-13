precision mediump float;

#pragma glslify: noise2d = require('glsl-noise/simplex/2d');

attribute vec2 a_circle_positions;
attribute float a_x;
attribute float a_initial_offset;
attribute float a_speed;

uniform float u_aspect;
uniform float u_time;

void main() {
  vec2 adjusted_position = a_circle_positions * 0.003;

  adjusted_position.x /= u_aspect;
  adjusted_position.x += 2.0 * a_x - 1.0;

  float offset_y = mod(a_initial_offset + 1.0 + a_speed * u_time / 500000.0, 2.0) - 1.0;

  adjusted_position.x += noise2d(vec2(a_x * 100.0 + 123.4, offset_y * 0.5 + u_time / 100000.0)) / 10.0;
  adjusted_position.y += offset_y + noise2d(vec2(a_x * 1234.0, u_time / 10000.0 + 100.0)) / 50.0;

  adjusted_position *= 1.1;

  gl_Position = vec4(adjusted_position, 0.0, 1.0);
}
