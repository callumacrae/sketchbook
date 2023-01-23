#define SQUARE_SIZE 0.01 // 0.001 - 0.05
#define RAND_REPEAT_CHANCE 0.3 // 0.0 - 0.5
#define BG_NOISE_FACTOR 3.0 // 0.0 - 10.0
#define BG_RAND_TO_NOISE_RATIO 0.6 // 0.0 - 1.0
#define DEBUG_BACKGROUND false

#define BASE_TRIANGLE_SIZE 0.08 // 0.01 - 0.4
#define POSITION_NOISE_FACTOR 0.7 // 0.0 - 10.0
#define ANGLE_NOISE_FACTOR 0.5 // 0.0 - 10.0

#define PI 3.1415926535897932384626433832795 // no-config

/** VENDOR START **/

// https://gist.github.com/patriciogonzalezvivo/670c22f3966e662d2f83
float rand(float n){return fract(sin(n) * 43758.5453123);}
float rand(int n) { return rand(float(n)) * 1000.0; }
vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
float snoise(vec2 v){ const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439); vec2 i  = floor(v + dot(v, C.yy) ); vec2 x0 = v -   i + dot(i, C.xx); vec2 i1; i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0); vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1; i = mod(i, 289.0); vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 )); vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0); m = m*m ; m = m*m ; vec3 x = 2.0 * fract(p * C.www) - 1.0; vec3 h = abs(x) - 0.5; vec3 ox = floor(x + 0.5); vec3 a0 = x - ox; m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h ); vec3 g; g.x  = a0.x  * x0.x  + h.x  * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw; return 130.0 * dot(m, g); }

// https://web.archive.org/web/20200207113336/http://lolengine.net/blog/2013/07/27/rgb-to-hsv-in-glsl
vec3 hsv2rgb(vec3 c) { vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0); vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www); return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y); }

/** VENDOR END **/

mat3 translationMatrix(float x, float y) {
  return mat3(1, 0, 0, 0, 1, 0, x, y, 1);
}
mat3 rotationMatrix(float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0);
}
mat3 scaleMatrix(float x, float y) {
  return mat3(x, 0, 0, 0, y, 0, 0, 0, 1);
}

// TS = triangle space
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;

  vec2 triangleFrom = vec2(
      snoise(vec2(iTime * POSITION_NOISE_FACTOR / 100.0 + rand(2), 0.0)) * 0.4 + 0.5,
      snoise(vec2(iTime * POSITION_NOISE_FACTOR / 100.0 + rand(5), 0.0)) * 0.4 + 0.5
      );
  float triangleAngle = snoise(vec2(iTime * ANGLE_NOISE_FACTOR / 100.0 + rand(4), 0.0)) * PI * 3.0;
  float triangleSize = BASE_TRIANGLE_SIZE;

  float triangleHeight = triangleSize / 2.0 / tan(PI / 6.0);

  vec2 uvTS = (rotationMatrix(triangleAngle) * vec3(uv - triangleFrom, 1.0)).xy;

  if (!DEBUG_BACKGROUND) {
    uvTS.y = mod(uvTS.y, triangleHeight * 2.0);
    if (uvTS.y > triangleHeight) {
      uvTS.y = 2.0 * triangleHeight - uvTS.y;
    }

    float modX = mod((uvTS.x + triangleSize / 2.0), triangleSize);
    float maxWidthAtX = uvTS.y / triangleHeight * triangleSize;
    // Inverted = point side up (the origin triangle is point side down)
    bool isInverted = abs(modX - triangleSize / 2.0) > maxWidthAtX / 2.0;

    float offsetX = floor((uvTS.x + (isInverted ? 0.0 : triangleSize / 2.0)) / triangleSize);
    uvTS.x -= offsetX * triangleSize;

    if (isInverted) {
      mat3 reflect = rotationMatrix(radians(-60.0)) * scaleMatrix(-1.0, 1.0);
      uvTS = (reflect * vec3(uvTS, 1.0)).xy;
    }

    float originY = triangleSize * sqrt(3.0) / 3.0;
    mat3 rotation = translationMatrix(0.0, originY) * rotationMatrix(radians(-120.0) * offsetX) * translationMatrix(0.0, -originY);
    uvTS = (rotation * vec3(uvTS, 1.0)).xy;
  }

  float size = SQUARE_SIZE * max(iResolution.x, iResolution.y);
  uv = (rotationMatrix(-triangleAngle) * vec3(uvTS, 1.0)).xy + triangleFrom;
  vec2 xy = uv * iResolution.xy / size;
  xy.x = floor(xy.x);
  xy.y = floor(xy.y);

  float randIndex = xy.x + xy.y * (1.0 / SQUARE_SIZE);

  // Make it so there's two or three in a row sometimes
  if (rand(randIndex - 1.0) > (1.0 - RAND_REPEAT_CHANCE / 2.0)) {
    randIndex -= 2.0;
  } else if (rand(randIndex) > (1.0 - RAND_REPEAT_CHANCE)) {
    randIndex -= 1.0;
  }

  float hRand = rand(randIndex);
  float hNoise = snoise(xy * BG_NOISE_FACTOR / 100.0) * 0.5 + 0.5;
  float h = mix(hNoise, hRand, BG_RAND_TO_NOISE_RATIO);

  fragColor = vec4(hsv2rgb(vec3(h, 0.55, 0.75)), 1.0);
}
