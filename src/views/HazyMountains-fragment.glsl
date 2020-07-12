precision mediump float;

varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform float uDepth;
 
float adjustForDepth(float value) {
  return value + uDepth * (1.0 - value);
}

void main(void) {
  vec3 color = vec3(
    adjustForDepth(0.051),
    adjustForDepth(0.122),
    adjustForDepth(0.2)
  );

  gl_FragColor = vec4(color, 1.0);
}
