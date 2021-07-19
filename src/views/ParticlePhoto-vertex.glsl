precision mediump float;

#pragma glslify: noise2d = require('glsl-noise/simplex/2d');

attribute float a_x;
attribute float a_initial_offset;
attribute float a_speed;

uniform float u_time;
uniform sampler2D u_image_texture;
uniform float u_width;
uniform float u_x_in_noise_multiplier;
uniform float u_x_out_noise_multiplier;
uniform float u_y_in_noise_multiplier;
uniform float u_y_out_noise_multiplier;
uniform float u_point_size_multiplier;

varying vec2 v_position;
varying float v_initial_offset;

void main() {
  vec2 position = vec2(2.0 * a_x - 1.0, 0.0);

  float offset_y = mod(a_initial_offset + 1.0 + a_speed * u_time / 500000.0, 2.0) - 1.0;

  position.x += noise2d(
      vec2(a_x * u_x_in_noise_multiplier + 123.4, offset_y * 0.5 + u_time / 100000.0)
    ) * u_x_out_noise_multiplier;
  position.y += offset_y + noise2d(
      vec2(a_x * u_y_in_noise_multiplier, u_time / 10000.0 + 100.0)
    ) * u_y_out_noise_multiplier;

  position.y *= 1.1;

  v_position = position;
  v_initial_offset = a_initial_offset;

  gl_Position = vec4(position, 0.0, 1.0);
  gl_PointSize = u_width / 660.0 * u_point_size_multiplier;
}
