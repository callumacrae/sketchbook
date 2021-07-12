precision mediump float;

attribute vec2 a_position;

uniform float u_id;
uniform float u_aspect;
uniform float u_scale;

void main() {
  vec2 adjusted_position = a_position * u_scale;
  adjusted_position.x /= u_aspect;
  gl_Position = vec4(adjusted_position + u_id, u_id, 1.0);
}
