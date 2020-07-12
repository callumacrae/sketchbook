precision mediump float;

varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform float uDepth;
uniform float uStartY;
 
float adjustForDepth(float value) {
  return value + uDepth * (1.0 - value);
}

void main(void) {
  vec3 colorFrom = vec3(
    adjustForDepth(0.051),
    adjustForDepth(0.122),
    adjustForDepth(0.2)
  );
  vec3 colorTo = vec3(1.0);

  float distanceFromY = uStartY - gl_FragCoord.y;

  float fadeOutAt = 1500.0 * (1.0 - uDepth);
  float distFactor = min(max(0.0, distanceFromY / fadeOutAt), 1.0);
  vec3 color = (1.0 - distFactor) * colorFrom + distFactor * colorTo;

  /* gl_FragColor = vec4(colorFrom, 1.0); */
  gl_FragColor = vec4(color, 1.0);
}
