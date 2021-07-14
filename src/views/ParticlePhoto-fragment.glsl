precision mediump float;

uniform sampler2D u_image_texture;

varying vec2 v_position;

void main() {
  vec2 position = v_position;
  position.y *= -1.0;

  gl_FragColor = texture2D(u_image_texture, (position + 1.0) / 2.0);

  vec2 pc = (gl_PointCoord - 0.5) * 2.0;
  float dist = sqrt(pc.x * pc.x + pc.y * pc.y);
  float alpha = smoothstep(1.0, 0.9, dist);

  gl_FragColor.a *= alpha;
}
