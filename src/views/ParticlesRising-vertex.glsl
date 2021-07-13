precision mediump float;

attribute vec2 a_circle_positions;

uniform float u_x;
uniform float u_aspect;
uniform float u_time;
uniform float u_initial_offset;
uniform float u_speed;

void main() {
  float scale = 0.007;

  vec2 adjusted_position = a_circle_positions * scale;

  adjusted_position.x /= u_aspect;
  adjusted_position.x += 2.0 * u_x - 1.0;

  adjusted_position.y += mod(u_initial_offset + u_speed * u_time / 500000.0, 2.0) - 1.0;

  adjusted_position *= 1.1;

  gl_Position = vec4(adjusted_position, 0.0, 1.0);
}
