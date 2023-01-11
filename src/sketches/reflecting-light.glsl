#define LIGHT_VIS_SIZE 10.0

mat3 rotationMatrix(float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0);
}

mat3 scaleXMatrix(float scale) {
  return mat3(scale, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0);
}

mat3 translateMatrix(vec2 translate) {
  return mat3(1.0, 0.0, translate.x, 0.0, 1.0, translate.y, 0.0, 0.0, 1.0);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  // TODO: Pass all these in as uniforms when not in shadertoy
  vec2 lightPos = vec2(iResolution.x * 0.2 + sin(iTime * 0.4 + 0.25) * 40.0, iResolution.y * 0.8);
  vec2 mirrorCenter = vec2(iResolution.x * 0.25, iResolution.y * 0.5);
  float mirrorLength = iResolution.x * 0.2;
  float mirrorAngle = 3.1516 / 4.0 + sin(iTime) * 0.1; // anti-clockwise from vertical
  mat3 mirrorTransform = translateMatrix(-mirrorCenter) * rotationMatrix(mirrorAngle);

  vec3 lightPosMirrorSpace = vec3(lightPos, 1.0) * mirrorTransform;
  vec3 reflectedLightPos = lightPosMirrorSpace * scaleXMatrix(-1.0);
  vec3 fragCoordMirrorSpace = vec3(fragCoord, 1.0) * mirrorTransform;

  float shadowIntersection = fragCoordMirrorSpace.y - fragCoordMirrorSpace.x
    * (lightPosMirrorSpace.y - fragCoordMirrorSpace.y) / (lightPosMirrorSpace.x - fragCoordMirrorSpace.x);

  float reflectionIntersection = fragCoordMirrorSpace.y - fragCoordMirrorSpace.x
    * (reflectedLightPos.y - fragCoordMirrorSpace.y) / (reflectedLightPos.x - fragCoordMirrorSpace.x);

  if (abs(fragCoordMirrorSpace.x) < 3.0 &&
      abs(fragCoordMirrorSpace.y) < mirrorLength / 2.0) {
    fragColor = vec4(1.0);
  } else if (distance(fragCoord, lightPos) < LIGHT_VIS_SIZE) {
    fragColor = vec4(1.0);
  } else if (abs(shadowIntersection) < mirrorLength / 2.0 && fragCoordMirrorSpace.x < 0.0) {
    fragColor = vec4(vec3(0.0), 1.0);
  } else if (abs(reflectionIntersection) < mirrorLength / 2.0 && fragCoordMirrorSpace.x > 0.0) {
    fragColor = vec4(1.0, 0.8, 0.0, 1.0);
  } else {
    fragColor = vec4(0.5, 0.4, 0.0, 1.0);
  }
}
