#define BAR_INTERVAL 80.0
#define BAR_HEIGHT iResolution.y - 200.0
#define BAR_WIDTH 8.0
#define TIME_FACTOR 100.0
#define MOUSE_FACTOR_X 100.0
#define MOUSE_FACTOR_Y 50.0
#define ROW_DENSITY 5.0
#define LIGHT_FADE_FACTOR 2.0

float colorForCol(vec2 fragCoord, float rowFactor) {
  float barHeight = (BAR_HEIGHT) * rowFactor;
  float mouseOffsetY = iMouse.y == 0.0 ?
    0.0 :
    (iMouse.y / iResolution.y - 0.5) * MOUSE_FACTOR_Y;
  float distFromCenterY = abs((fragCoord.y + mouseOffsetY) - iResolution.y / 2.0);

  float offsetYFromEnd = barHeight / 2.0 - distFromCenterY;
  if (offsetYFromEnd < 0.0) {
    return 0.0;
  }

  float barInterval = BAR_INTERVAL * rowFactor;
  float barWidth = BAR_WIDTH * rowFactor;
  float timeOffset = iTime * TIME_FACTOR * rowFactor;
  float mouseOffsetX = iMouse.x == 0.0 ?
    0.0 :
    (iMouse.x / iResolution.x - 0.5) * MOUSE_FACTOR_X * rowFactor;
  
  float distFromCenterX = abs((fragCoord.x + timeOffset + mouseOffsetX) - iResolution.x / 2.0);
  if (distFromCenterX < distFromCenterY - barHeight / 2.0) {
    return 0.0;
  }
  
  float offsetXInBar = mod(distFromCenterX + barWidth / 2.0, barInterval);
  float offsetXFromCenterOfBar = abs(barWidth / 2.0 - offsetXInBar);
  float radius = sqrt(pow(offsetXFromCenterOfBar, 2.0) + pow(barWidth / 2.0 - offsetYFromEnd, 2.0));
  
  if (offsetXInBar < barWidth && (offsetYFromEnd > barWidth / 2.0 || radius < barWidth / 2.0)) {
    return pow(rowFactor, LIGHT_FADE_FACTOR);
  } else {
    return 0.0;
  }
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float color = 0.0;
  
  for (float i = 1.0; i != 20.0; ++i) {
    float rowFactor = ROW_DENSITY / (i + ROW_DENSITY - 1.0);
    color = max(color, colorForCol(fragCoord, rowFactor));
  }

  fragColor = vec4(vec3(color), 1.0);
}
