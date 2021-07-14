precision mediump float;

#pragma glslify: noise2d = require('glsl-noise/simplex/2d');

attribute float a_x;
attribute float a_initial_offset;
attribute float a_speed;

uniform float u_time;
uniform sampler2D u_image_texture;

varying vec2 v_position;

void main() {
  vec2 position = vec2(2.0 * a_x - 1.0, 0.0);

  float offset_y = mod(a_initial_offset + 1.0 + a_speed * u_time / 500000.0, 2.0) - 1.0;

  position.x += noise2d(vec2(a_x * 100.0 + 123.4, offset_y * 0.5 + u_time / 100000.0)) / 10.0;
  position.y += offset_y + noise2d(vec2(a_x * 1234.0, u_time / 10000.0 + 100.0)) / 50.0;

  position.y *= 1.1;

  v_position = position;

  gl_Position = vec4(position, 0.0, 1.0);
  gl_PointSize = 15.0;
}
