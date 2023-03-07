#define SPHERE_RADIUS 0.35 // 0.1 - 0.6
#define ELLIPSE_SQUASH_FACTOR 3.85 // 1.0 - 10.0
#define TIME_FACTOR 1.0 // 0.1 - 10.0
#define LINE_THICKNESS_FACTOR 120.0 // 50.0 - 300.0

// name: Circle sphere
// date: 2022-12-28
// tags: GLSL
// favourite: true
// shadertoy: https://www.shadertoy.com/view/dtX3Dj

// https://web.archive.org/web/20200207113336/http://lolengine.net/blog/2013/07/27/rgb-to-hsv-in-glsl
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void drawCircle(inout vec4 fragColor, vec2 fragCoord, float offsetFactor, float hue, float sphereRadius) {
  // ellipse: ( y * a ) ^ 2 + x ^ 2 = radius ^ 2
  // line to point: y = fragCoord.x / fragCoord.y * x
  // adjustedRadius = sqrt(pow(x, 2.0) + pow(y, 2.0));

  vec2 origin = iResolution.xy / 2.0;
  float yOffset = offsetFactor * sphereRadius;
  float radius = sqrt(pow(sphereRadius, 2.0) - pow(yOffset, 2.0));

  float a = ELLIPSE_SQUASH_FACTOR;

  float x = abs(origin.x - fragCoord.x);
  float y = abs(origin.y - yOffset - fragCoord.y);
  float xOnCircle;
  float yOnCircle;
  if (x < 1.0) {
    xOnCircle = 0.0;
    yOnCircle = radius / a;
  } else {
    xOnCircle = sqrt(pow(radius, 2.0) / (pow(a, 2.0) * pow(y / x, 2.0) + 1.0));
    yOnCircle = y / x * xOnCircle;
  }
  float adjustedRadius = sqrt(pow(xOnCircle, 2.0) + pow(yOnCircle, 2.0));

  float dist = sqrt(pow(x, 2.0) + pow(y, 2.0));

  float innerLineWidth = sphereRadius / LINE_THICKNESS_FACTOR;
  float outerLineWidth = sphereRadius / LINE_THICKNESS_FACTOR * 3.0;

  float alpha = 0.0;
  if (dist < adjustedRadius + innerLineWidth / 2.0 && dist > adjustedRadius - innerLineWidth / 2.0) {
    alpha = 1.0;
  } else if (dist < adjustedRadius) {
    alpha = smoothstep(adjustedRadius - outerLineWidth / 2.0, adjustedRadius - innerLineWidth / 2.0, dist);
  } else {
    alpha = smoothstep(adjustedRadius + outerLineWidth / 2.0, adjustedRadius + innerLineWidth / 2.0, dist);
  }

  if (alpha > 0.0) {
    fragColor.rgb = mix(fragColor.xyz, hsv2rgb(vec3(hue, 0.75, 0.75)), alpha);
  }
}

void mainImage(out vec4 fragColor, vec2 fragCoord) {
  fragColor = vec4(vec3(0.0), 1.0);

  float adjustedTime = iTime * TIME_FACTOR;

  float sphereRadius = min(iResolution.x, iResolution.y) * SPHERE_RADIUS;
  float layers = 20.0;
  for (float i = 0.0; i != layers; ++i) {
    float offsetFactor = cos(3.1416 / layers * (i + mod(adjustedTime, 1.0)));
    float hue = mod((i - floor(adjustedTime)) / layers, 1.0);
    drawCircle(fragColor, fragCoord, offsetFactor, hue, sphereRadius);
  }
}
