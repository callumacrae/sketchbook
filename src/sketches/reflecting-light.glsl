#define LIGHT_VIS_SIZE 10.0
#define LIGHT_VIS_GLOW_SIZE 40.0
#define LIGHT_START_POWER 0.6
#define LIGHT_DISTANCE 1500.0

// name: Reflecting light experiment
// date: 2023-01-11
// tags: GLSL

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
  vec2 mirrorCenter = iResolution.xy * vec2(0.25, 0.5);
  float mirrorLength = iResolution.x * 0.2;
  float mirrorAngle = 3.1516 / 4.0 + sin(iTime) * 0.1; // anti-clockwise from vertical
  mat3 mirrorTransform = translateMatrix(-mirrorCenter) * rotationMatrix(mirrorAngle);

  vec2 blockerCenter = iResolution.xy * vec2(0.7, 0.55);
  float blockerLength = iResolution.x * 0.15;
  float blockerAngle = 0.0;
  mat3 blockerTransform = translateMatrix(-blockerCenter) * rotationMatrix(blockerAngle);

  vec3 lightPosMirrorSpace = vec3(lightPos, 1.0) * mirrorTransform;
  vec3 reflectedLightPos = lightPosMirrorSpace * scaleXMatrix(-1.0);
  vec3 fragCoordMirrorSpace = vec3(fragCoord, 1.0) * mirrorTransform;

  vec3 lightPosBlockerSpace = vec3(lightPos, 1.0) * blockerTransform;
  vec3 fragCoordBlockerSpace = vec3(fragCoord, 1.0) * blockerTransform;

  float lightDistance = distance(fragCoord, lightPos);

  if (abs(fragCoordMirrorSpace.x) < 3.0 &&
      abs(fragCoordMirrorSpace.y) < mirrorLength / 2.0) {
    fragColor = vec4(1.0);
  } else if (abs(fragCoordBlockerSpace.x) < 3.0 &&
      abs(fragCoordBlockerSpace.y) < blockerLength / 2.0) {
    fragColor = vec4(vec3(0.6), 1.0);
  } else if (lightDistance < LIGHT_VIS_SIZE) {
    fragColor = vec4(1.0);
  } else {
    float light = 0.0;

    if (lightDistance < LIGHT_VIS_SIZE + LIGHT_VIS_GLOW_SIZE) {
      light = smoothstep(LIGHT_VIS_GLOW_SIZE, 0.0, lightDistance - LIGHT_VIS_SIZE) * (1.0 - LIGHT_START_POWER);
    }

    float reflectionIntersection = fragCoordMirrorSpace.y - fragCoordMirrorSpace.x
      * (reflectedLightPos.y - fragCoordMirrorSpace.y) / (reflectedLightPos.x - fragCoordMirrorSpace.x);

    if (abs(reflectionIntersection) < mirrorLength / 2.0 && fragCoordMirrorSpace.x > 0.0) {
      // Test if in shadow of blocker
      vec3 reflectedLightPosBS = reflectedLightPos * inverse(mirrorTransform) * blockerTransform;
      float reflectionIntersectionBS = fragCoordBlockerSpace.y - fragCoordBlockerSpace.x
        * (reflectedLightPosBS.y - fragCoordBlockerSpace.y) / (reflectedLightPosBS.x - fragCoordBlockerSpace.x);

      if (abs(reflectionIntersectionBS) > blockerLength / 2.0 || fragCoordBlockerSpace.x <= 0.0) {
        float dist = distance(fragCoord, reflectedLightPos.xy);
        /* light += 1.0 / pow(dist / 200.0, 2.0); */
        // This isn't physically realistic, but the inverse square law wasn't working out for me…
        light += smoothstep(LIGHT_DISTANCE, 0.0, dist) * LIGHT_START_POWER;
      }
    }

    float shadowIntersection = fragCoordMirrorSpace.y - fragCoordMirrorSpace.x
      * (lightPosMirrorSpace.y - fragCoordMirrorSpace.y) / (lightPosMirrorSpace.x - fragCoordMirrorSpace.x);

    if (abs(shadowIntersection) > mirrorLength / 2.0 || fragCoordMirrorSpace.x > 0.0) {
      float blockerIntersection = fragCoordBlockerSpace.y - fragCoordBlockerSpace.x
        * (lightPosBlockerSpace.y - fragCoordBlockerSpace.y) / (lightPosBlockerSpace.x - fragCoordBlockerSpace.x);

      if (abs(blockerIntersection) > blockerLength / 2.0 || fragCoordBlockerSpace.x <= 0.0) {
        float dist = distance(fragCoord, lightPos);
        /* light += 1.0 / pow(dist / 200.0, 2.0); */
        light += smoothstep(LIGHT_DISTANCE, 0.0, dist) * LIGHT_START_POWER;
      }
    }

    fragColor = vec4(vec3(1.0, 0.85, 0.25) * min(light, 1.0), 1.0);
  }
}
