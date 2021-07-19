precision mediump float;

uniform sampler2D u_image_texture;
uniform float u_radius_val_exponent;
uniform float u_alpha_val_exponent;
uniform float u_alpha_val_multiplier;
uniform bool u_color;
uniform float u_twinkle_frequency;
uniform float u_twinkle_intensity;
uniform float u_twinkle_factor;

varying vec2 v_position;
varying float v_initial_offset;

void main() {
  vec2 position = v_position;
  position.y *= -1.0;

  vec4 texture_color = texture2D(u_image_texture, (position + 1.0) / 2.0);

  // http://www.johndcook.com/blog/2009/08/24/algorithms-convert-color-grayscale/
  // The alpha multiplication stops random transparent white pixels from ruining everything
  float intensity = (0.21 * texture_color.r + 0.71 * texture_color.g + 0.07 * texture_color.b) * texture_color.a;

  float radius_val = pow(intensity, u_radius_val_exponent);
  float alpha_val = pow(intensity, u_alpha_val_exponent) * u_alpha_val_multiplier;

  float twinkle_y_normalised = abs(mod((position.y - v_initial_offset * 123.0) * 100.0, u_twinkle_frequency * 2.0) - u_twinkle_frequency);
  float twinkle_value = 1.0 - u_twinkle_factor + u_twinkle_factor * smoothstep(
      u_twinkle_frequency * (1.0 - 1.0 / u_twinkle_intensity / u_twinkle_frequency * 5.0),
      u_twinkle_frequency,
      twinkle_y_normalised
    );

  vec2 pc = (gl_PointCoord - 0.5) * 2.0;
  float dist = sqrt(pc.x * pc.x + pc.y * pc.y);
  float alpha = alpha_val * smoothstep(radius_val, radius_val - 0.1, dist) * twinkle_value;

  gl_FragColor = vec4(u_color ? texture_color.rgb : vec3(1.0), alpha);
}
