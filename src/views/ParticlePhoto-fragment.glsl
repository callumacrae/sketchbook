precision mediump float;

uniform sampler2D u_image_texture;

varying vec2 v_position;

void main() {
  vec2 position = v_position;
  position.y *= -1.0;

  vec4 texture_color = texture2D(u_image_texture, (position + 1.0) / 2.0);

  // http://www.johndcook.com/blog/2009/08/24/algorithms-convert-color-grayscale/
  float intensity = 0.21 * texture_color.r + 0.71 * texture_color.g + 0.07 * texture_color.b;

  float radius_val = pow(intensity, 3.5);
  float alpha_val = pow(intensity, 4.0) * 0.8;

  vec2 pc = (gl_PointCoord - 0.5) * 2.0;
  float dist = sqrt(pc.x * pc.x + pc.y * pc.y);
  float alpha = alpha_val * smoothstep(radius_val, radius_val - 0.1, dist);

  gl_FragColor = vec4(vec3(1.0), alpha);
}
