#define PIXELS_PER_PIXEL 8.0
#define RADIUS 25.0
#define RADIUS_VAR 3.0

// name: Anti-aliased circle
// date: 2022-12-27
// tags: GLSL
// shadertoy: https://www.shadertoy.com/view/Dts3zX

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec3 origin = iResolution / 2.0 / PIXELS_PER_PIXEL;
  float radius = RADIUS + cos(iTime) * RADIUS_VAR;

  // We check the intersections against the pixel represented by rectangle ABCD:
  //
  // (x, y)
  //      __D__
  //      |   |
  //      A   C
  //      |   |
  //      --B--
  //           (x + 1, y + 1)

  // Transform the points to test a circle about the point (0, 0) - means we don't
  // have to worry about the negative values of square roots
  float x = abs(origin.x - floor(fragCoord.x / PIXELS_PER_PIXEL));
  float y = abs(origin.y - floor(fragCoord.y / PIXELS_PER_PIXEL));

  float intersectionOnA = sqrt(pow(radius, 2.0) - pow(x, 2.0));
  bool isIntersectionWithinA = intersectionOnA >= y && intersectionOnA <= y + 1.0;

  float intersectionOnB = sqrt(pow(radius, 2.0) - pow(y + 1.0, 2.0));
  bool isIntersectionWithinB = intersectionOnB >= x && intersectionOnB <= x + 1.0;

  float intersectionOnC = sqrt(pow(radius, 2.0) - pow(x + 1.0, 2.0));
  bool isIntersectionWithinC = intersectionOnC >= y && intersectionOnC <= y + 1.0;

  float intersectionOnD = sqrt(pow(radius, 2.0) - pow(y, 2.0));
  bool isIntersectionWithinD = intersectionOnD >= x && intersectionOnD <= x + 1.0;

  float dist = sqrt(pow(x, 2.0) + pow(y, 2.0));
  float color = dist < radius ? 1.0 : 0.0;

  if (isIntersectionWithinA && isIntersectionWithinD) {
    color = (intersectionOnD - x) * (intersectionOnA - y) / 2.0;
  }
  if (isIntersectionWithinA && isIntersectionWithinC) {
    color = (intersectionOnA + intersectionOnC) / 2.0 - y;
  }
  if (isIntersectionWithinB && isIntersectionWithinC) {
    color = 1.0 - (x + 1.0 - intersectionOnB) * (y + 1.0 - intersectionOnC) / 2.0;
  }
  if (isIntersectionWithinB && isIntersectionWithinD) {
    color = (intersectionOnB + intersectionOnD) / 2.0 - x;
  }

  // lol what's the fun in this
  /* color = smoothstep(radius + 0.5, radius - 0.5, dist); */

  fragColor = vec4(vec3(color), 1.0);
}
