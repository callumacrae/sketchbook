#define SPHERE_RADIUS 200.0
#define ELLIPSE_SQUASH_FACTOR 4.0
#define LINE_WIDTH 5.0

void drawCircle(out vec4 fragColor, vec2 fragCoord, float yOffset) {
  // ellipse: ( y * a ) ^ 2 + x ^ 2 = radius ^ 2
  // line to point: y = fragCoord.x / fragCoord.y * x
  // adjustedRadius = sqrt(pow(x, 2.0) + pow(y, 2.0));

  vec2 origin = iResolution.xy / 2.0;
  float radius = sqrt(pow(SPHERE_RADIUS, 2.0) - pow(yOffset, 2.0));

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

  float color = 0.0;
  if (dist < adjustedRadius) {
    color = smoothstep(adjustedRadius - LINE_WIDTH / 2.0, adjustedRadius, dist);
  } else {
    color = smoothstep(adjustedRadius + LINE_WIDTH / 2.0, adjustedRadius, dist);
  }

  if (color > fragColor.r) {
    fragColor = vec4(vec3(color), 1.0);
  }
}

void mainImage(out vec4 fragColor, vec2 fragCoord) {
  fragColor = vec4(vec3(0.0), 1.0);

  for (float i = -180.0; i != 200.0; i += 20.0) {
    drawCircle(fragColor, fragCoord, i);
  }
}
