precision mediump float;

#pragma glslify: snoise3 = require(glsl-noise/simplex/3d)
#pragma glslify: pnoise2 = require(glsl-noise/periodic/2d)

varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform float uDepth;
uniform float uStartY;
uniform bool uBackground;
 
float adjustForDepth(float value) {
  return value + uDepth * (1.0 - value);
}

void main(void) {
  vec3 background = vec3(0.961, 0.973, 0.992);
  vec3 colorFrom = uBackground ?
    background :
    vec3(
      adjustForDepth(0.051),
      adjustForDepth(0.122),
      adjustForDepth(0.2)
    );
  vec3 colorTo = background;

  float distanceFromY = uStartY - gl_FragCoord.y;

  float fadeOutAt = 1500.0 * (1.0 - uDepth);
  float distFactor = min(max(0.0, distanceFromY / fadeOutAt), 1.0);
  vec3 color = (1.0 - distFactor) * colorFrom + distFactor * colorTo;

  float periodicNoise = pnoise2(
    vec2(gl_FragCoord.x, gl_FragCoord.y / 10.0),
    vec2(1.0, 100.0)
  );

  float simplexNoise = snoise3(vec3(gl_FragCoord.xy, gl_FragCoord.y / 80.0));

  float aproxLightness = (color.r + color.g + color.b) / 3.0;

  float noiseFactor = uBackground ? 0.2 : 0.35;
  float lightnessFactor = 0.3;
  float depthFactor = 0.4;
  float periodicNoiseFactor = 0.5;
  float noise = noiseFactor *
    ((1.0 - lightnessFactor) + aproxLightness * lightnessFactor) *
    ((1.0 - depthFactor) + (1.0 - uDepth) * depthFactor) *
    ((1.0 - periodicNoiseFactor) + periodicNoiseFactor * periodicNoise) *
    simplexNoise;

  gl_FragColor = vec4(color + noise, 1.0);
}
