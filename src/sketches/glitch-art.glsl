#define LINES 20.0
#define LINE_WIDTH 4.0
#define LINE_SMOOTH_WIDTH 1.5

// https://gist.github.com/patriciogonzalezvivo/670c22f3966e662d2f83
vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
float snoise(vec2 v){ const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439); vec2 i  = floor(v + dot(v, C.yy) ); vec2 x0 = v -   i + dot(i, C.xx); vec2 i1; i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0); vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1; i = mod(i, 289.0); vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 )); vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0); m = m*m ; m = m*m ; vec3 x = 2.0 * fract(p * C.www) - 1.0; vec3 h = abs(x) - 0.5; vec3 ox = floor(x + 0.5); vec3 a0 = x - ox; m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h ); vec3 g; g.x  = a0.x  * x0.x  + h.x  * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw; return 130.0 * dot(m, g); }

const float innerWidth = LINE_WIDTH / 2.0;
const float outerWidth = LINE_WIDTH / 2.0 + LINE_SMOOTH_WIDTH;

void drawLine(inout vec4 fragColor, in vec2 fragCoord, float i) {
  float lineY = iResolution.y / LINES * (i + 0.5) ;
  float angleRoot = snoise(vec2(iTime * 0.1, 0.0)) * 0.2;
  float angleFactor = snoise(vec2((iTime + 1000.0) * 0.08, 0.0)) * 0.015;
  float angle = angleRoot + (LINES / 2.0 - i) * angleFactor;

  float reflectAt = iResolution.x * 0.33 + snoise(vec2((iTime + 10.0) * 0.1, 0.0)) * 100.0;
  float reflectedMultFact = 1.5 + snoise(vec2(iTime * 0.12 + 3.0, 0.0)) * 1.0;
  float reflectedX = fragCoord.x < reflectAt ? reflectAt + reflectedMultFact * (reflectAt - fragCoord.x) : fragCoord.x;

  float lineYAtX = lineY - reflectedX * tan(angle);

  if (fragCoord.y > lineYAtX - outerWidth && fragCoord.y < lineYAtX + outerWidth) {
    float color = smoothstep(outerWidth, innerWidth, abs(fragCoord.y - lineYAtX));
    fragColor = vec4(vec3(color), 1.0);
  }
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;

  fragColor = vec4(0.0, 0.0, 0.0, 1.0);

  for (float i = -5.0; i != LINES + 5.0; ++i) {
    drawLine(fragColor, fragCoord, i);
  }
}
