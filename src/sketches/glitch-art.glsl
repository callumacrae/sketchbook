#define LINES 20.0
#define LINE_WIDTH 4.0
#define LINE_SMOOTH_WIDTH 1.5

#define GLITCH_COLOR_INVERT_ENABLED true
#define GLITCH_COLOR_SPLIT_ENABLED true
#define GLITCH_COLOR_SWAP_ENABLED true

#define GLITCH_POSITION_RECT_SWAP_ENABLED true
#define GLITCH_POSITION_Y_BAND_SHIFT_ENABLED true
#define GLITCH_POSITION_FLIP_ENABLED true

#define GLITCH_OTHER_BREAK_REFLECTION_ENABLED true
#define GLITCH_OTHER_BLANK_ENABLED true
#define GLITCH_OTHER_LINE_WIDTH_CHANGES_ENABLED true

/** VENDOR START **/

// https://gist.github.com/patriciogonzalezvivo/670c22f3966e662d2f83
float rand(float n){return fract(sin(n) * 43758.5453123);}
float rand(int n) { return rand(float(n)) * 1000.0; }
vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
float snoise(vec2 v){ const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439); vec2 i  = floor(v + dot(v, C.yy) ); vec2 x0 = v -   i + dot(i, C.xx); vec2 i1; i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0); vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1; i = mod(i, 289.0); vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 )); vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0); m = m*m ; m = m*m ; vec3 x = 2.0 * fract(p * C.www) - 1.0; vec3 h = abs(x) - 0.5; vec3 ox = floor(x + 0.5); vec3 a0 = x - ox; m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h ); vec3 g; g.x  = a0.x  * x0.x  + h.x  * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw; return 130.0 * dot(m, g); }

// https://web.archive.org/web/20200207113336/http://lolengine.net/blog/2013/07/27/rgb-to-hsv-in-glsl
vec3 hsv2rgb(vec3 c) { vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0); vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www); return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y); }

/** VENDOR END **/

float drawLine(vec2 fragCoord, float i) {
  float lineWidth = LINE_WIDTH;

  if (GLITCH_OTHER_LINE_WIDTH_CHANGES_ENABLED) {
    float lineWidthNoise = snoise(vec2(iTime * 2.0 + rand(35), 0.0));
    if (lineWidthNoise < -0.8) {
      lineWidth *= 3.0;
    }
  }

  float innerWidth = lineWidth / 2.0;
  float outerWidth = lineWidth / 2.0 + LINE_SMOOTH_WIDTH;

  float lineY = iResolution.y / LINES * (i + 0.5) ;
  float angleRoot = snoise(vec2(iTime * 0.1 + rand(1), 0.0)) * 0.2;
  float angleFactor = snoise(vec2(iTime * 0.08 + rand(2), 0.0)) * 0.015;
  float angle = angleRoot + (LINES / 2.0 - i) * angleFactor;

  float x = fragCoord.x;

  bool shouldReflect = !GLITCH_OTHER_BREAK_REFLECTION_ENABLED ||
    snoise(vec2(iTime * 1.2 + rand(15), 0.0)) > -0.5;
  float reflectAt = iResolution.x * 0.33 + snoise(vec2(iTime * 0.1 + rand(3), 0.0)) * 100.0;
  float reflectedMultFact = 1.5 + snoise(vec2(iTime * 0.12 + rand(4), 0.0)) * 1.0;
  x = shouldReflect && x < reflectAt
    ? reflectAt + reflectedMultFact * (reflectAt - x)
    : x;

  float lineYAtX = lineY - x * tan(angle);

  if (fragCoord.y > lineYAtX - outerWidth && fragCoord.y < lineYAtX + outerWidth) {
    return smoothstep(outerWidth, innerWidth, abs(fragCoord.y - lineYAtX));
  }
  return 0.0;
}

void generateRectangle(out float width, out float height, out vec2 topLeft,
    int randFrom, float minWidth, float maxWidth, float widthVar,
    float minHeight, float maxHeight, float heightVar) {
  float widthNoise = (snoise(vec2(iTime * widthVar + rand(randFrom + 12))) + 1.0) / 2.0;
  width = iResolution.x * (minWidth + widthNoise * (maxWidth - minWidth));
  float heightNoise = (snoise(vec2(iTime * heightVar + rand(randFrom + 13))) + 1.0) / 2.0;
  height = iResolution.x * (minHeight + heightNoise * (maxHeight - minHeight));

  topLeft = iResolution.xy * (vec2(
    snoise(vec2(iTime * 0.05 + rand(randFrom + 6), 0.0)),
    snoise(vec2(iTime * 0.1 + rand(randFrom + 7), 0.0))
  ) * 0.5 + 0.5) - width / 2.0;
}

bool isInRectangle(float width, float height, vec2 topLeft, vec2 fragCoord) {
  return fragCoord.x > topLeft.x && fragCoord.x < topLeft.x + width &&
    fragCoord.y > topLeft.y && fragCoord.y < topLeft.y + height;
}

void swapRectangle(inout vec2 fragCoord, int randFrom, int randFromB) {
  float width;
  float height;
  vec2 topLeftA;

  generateRectangle(width, height, topLeftA, randFrom, 0.2, 0.5, 0.01, 0.2, 0.5, 0.01);

  // Copied from generateRectangle
  vec2 topLeftB = iResolution.xy * (vec2(
    snoise(vec2(iTime * 0.05 + rand(randFromB + 10), 0.0)),
    snoise(vec2(iTime * 0.05 + rand(randFromB + 11), 0.0))
  ) * 0.5 + 0.5) - height / 2.0;

  if (isInRectangle(width, height, topLeftA, fragCoord)) {
    fragCoord.x = fragCoord.x - topLeftA.x + topLeftB.x;
    fragCoord.y = fragCoord.y - topLeftA.y + topLeftB.y;
  } else if (isInRectangle(width, height, topLeftB, fragCoord)) {
    fragCoord.x = fragCoord.x - topLeftB.x + topLeftA.x;
    fragCoord.y = fragCoord.y - topLeftB.y + topLeftA.y;
  }
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec3 colorOut = vec3(0.0);

  if (GLITCH_POSITION_RECT_SWAP_ENABLED) {
    int randFrom = int(floor(snoise(vec2(iTime * 0.2 + rand(35), 0.0)) * 2.0));
    int randFromB = int(floor(snoise(vec2(iTime * 0.2 + rand(36), 0.0)) * 2.0));
    float rectSwapNoise = snoise(vec2(iTime * 2.0 + rand(14), 0.0));
    if (rectSwapNoise < -0.6) swapRectangle(fragCoord, randFrom, randFromB);
    if (rectSwapNoise < -0.9) swapRectangle(fragCoord, randFrom + 1000, randFromB + 1000);
    if (rectSwapNoise < -0.05 && rectSwapNoise > -0.15) swapRectangle(fragCoord, randFrom + 2000, randFromB + 2000);
    if (rectSwapNoise > 0.6) swapRectangle(fragCoord, randFrom + 10000, randFromB + 10000);
    if (rectSwapNoise > 0.9) swapRectangle(fragCoord, randFrom + 11000, randFromB + 11000);
  }

  float bandShiftNoise = snoise(vec2(iTime * 1.3 + rand(23), 0.0));
  if (GLITCH_POSITION_Y_BAND_SHIFT_ENABLED && bandShiftNoise < -0.3) {
    float randAmount = rand(floor(snoise(vec2(iTime * 0.2 + rand(37), 0.0)) * 4.0)) * 80.0;
    float bandHeight = 40.0 + randAmount; // TODO: randomise this per band?
    fragCoord.x += rand(floor(fragCoord.y / bandHeight)) * 300.0;
  }

  if (GLITCH_POSITION_FLIP_ENABLED) {
    float flipNoise = snoise(vec2(iTime * 1.5 + rand(27), 0.0));
    float flipDirectionNoise = snoise(vec2(iTime * 8.0 + rand(28), 0.0));

    if (flipNoise < -0.85) {
      if (flipDirectionNoise < 0.0) {
        fragCoord.x = iResolution.x - fragCoord.x;
      } else {
        fragCoord.y = iResolution.y - fragCoord.y;
      }
    } else if (flipNoise < 0.5 && flipNoise > 0.2) {
        int randFrom = 9292 + int(floor(snoise(vec2(iTime * 3.0 + rand(29), 0.0)) * 2.0));
        float glitchWidth;
        float glitchHeight;
        vec2 glitchTopLeft;
        generateRectangle(glitchWidth, glitchHeight, glitchTopLeft, randFrom, 0.2, 0.7, 0.15, 0.3, 0.7, 0.15);

        if (isInRectangle(glitchWidth, glitchHeight, glitchTopLeft, fragCoord)) {
          if (flipDirectionNoise < 0.0) {
            fragCoord.x = 2.0 * glitchTopLeft.x + glitchWidth - fragCoord.x;
          } else {
            fragCoord.y = 2.0 * glitchTopLeft.y + glitchHeight - fragCoord.y;
          }
        }
    }
  }

  for (float i = -5.0; i != LINES + 5.0; ++i) {
    float color = drawLine(fragCoord, i);
    if (color > 0.0) {
      colorOut = vec3(color);
    }

    // TODO: move out of loop for perf somehow?
    if (GLITCH_COLOR_SPLIT_ENABLED) {
      bool shouldGlitchColor1 = snoise(vec2(iTime * 3.0 + rand(18), 0.0)) < -0.5;
      if (shouldGlitchColor1) {
        int randFrom = 2347 + int(floor(snoise(vec2(iTime * 4.0 + rand(30), 0.0)) * 2.0));
        float glitchWidth;
        float glitchHeight;
        vec2 glitchTopLeft;
        generateRectangle(glitchWidth, glitchHeight, glitchTopLeft, randFrom, 0.1, 1.3, 0.2, 0.1, 1.3, 0.2);

        if (isInRectangle(glitchWidth, glitchHeight, glitchTopLeft, fragCoord)) {
          if (color > 0.0) {
            colorOut.r = 0.0;
          }

          // Multiplying the noise, flooring it, and using it to generate a random
          // number creates a sort of jerking effect
          vec2 colorSplitDist = vec2(
              50.0 * rand(floor((snoise(vec2(iTime * 0.01 + rand(16), 0.0)) * 100.0))),
              7.0 * rand(floor((snoise(vec2(iTime * 0.01 + rand(17), 0.0)) * 40.0)))
              );
          float otherColor = drawLine(fragCoord + colorSplitDist, i);
          if (otherColor > 0.0) {
            colorOut.r = otherColor;
          }
        }
      }

      // Yes this is duplicated im sorry lol
      bool shouldGlitchColor2 = snoise(vec2(iTime * 3.0 + rand(24), 0.0)) < -0.5;
      if (shouldGlitchColor2) {
        int randFrom = 8374 + int(floor(snoise(vec2(iTime * 5.0 + rand(31), 0.0)) * 2.0));
        float glitchWidth;
        float glitchHeight;
        vec2 glitchTopLeft;
        generateRectangle(glitchWidth, glitchHeight, glitchTopLeft, randFrom, 0.1, 1.3, 0.4, 0.1, 1.3, 0.15);

        if (isInRectangle(glitchWidth, glitchHeight, glitchTopLeft, fragCoord)) {
          if (color > 0.0) {
            colorOut.r = 0.0;
          }

          // Multiplying the noise, flooring it, and using it to generate a random
          // number creates a sort of jerking effect
          vec2 colorSplitDist = vec2(
              60.0 * rand(floor((snoise(vec2(iTime * 0.01 + rand(25), 0.0)) * 100.0))),
              4.0 * rand(floor((snoise(vec2(iTime * 0.01 + rand(26), 0.0)) * 40.0)))
              );
          float otherColor = drawLine(fragCoord + colorSplitDist, i);
          if (otherColor > 0.0) {
            colorOut.r = otherColor;
          }
        }
      }
    }
  }

  float blankNoise = snoise(vec2(iTime * 0.7 + rand(19), 0.0));
  if (GLITCH_OTHER_BLANK_ENABLED) {
    if (blankNoise < -0.8) {
      colorOut = vec3(0.0);
    } else if (blankNoise > 0.3) {
      float blankNoise2 = snoise(vec2(iTime * 1.6 + rand(20), 0.0));
      if (blankNoise2 < -0.1) {
        int randFrom = 2479 + int(floor(snoise(vec2(iTime * 2.0 + rand(32), 0.0)) * 1.5));
        float glitchWidth;
        float glitchHeight;
        vec2 glitchTopLeft;
        generateRectangle(glitchWidth, glitchHeight, glitchTopLeft, randFrom, 0.1, 0.7, 0.06, 0.2, 0.6, 0.05);

      if (isInRectangle(glitchWidth, glitchHeight, glitchTopLeft, fragCoord)) {
        colorOut = vec3(0.0);
      }
    }
    }
  }

  float invertColorNoise = snoise(vec2(iTime * 0.6 + rand(5), 0.0));
  if (GLITCH_COLOR_INVERT_ENABLED) {
    if (invertColorNoise < -0.85) {
      colorOut = vec3(1.0) - colorOut;
    } else if (invertColorNoise > 0.4) {
      float invertColorNoise2 = snoise(vec2(iTime * 3.2 + rand(18), 0.0));
      if (invertColorNoise2 < -0.3) {
        int randFrom = 7254 + int(floor(snoise(vec2(iTime * 2.0 + rand(33), 0.0)) * 2.5));
        float glitchWidth;
        float glitchHeight;
        vec2 glitchTopLeft;
        generateRectangle(glitchWidth, glitchHeight, glitchTopLeft, randFrom, 0.2, 0.6, 0.18, 0.2, 0.6, 0.22);

        if (isInRectangle(glitchWidth, glitchHeight, glitchTopLeft, fragCoord)) {
          colorOut = vec3(1.0) - colorOut;
        }
      }
    }
  }

  float swapColorNoise = snoise(vec2(iTime * 0.6 + rand(21), 0.0));
  if (GLITCH_COLOR_SWAP_ENABLED && colorOut.r + colorOut.g + colorOut.b > 2.5) {
    float hue = snoise(vec2(iTime * 0.3 + rand(23), 0.0)) / 2.0 + 0.5;
    vec3 newColor = hsv2rgb(vec3(hue, 0.75, 0.75));

    if (swapColorNoise < -0.75) {
      colorOut = newColor;
    } else if (swapColorNoise > 0.4) {
      float swapColorNoise2 = snoise(vec2(iTime * 2.6 + rand(22), 0.0));
      if (swapColorNoise2 < -0.3) {
        int randFrom = 29482 + int(floor(snoise(vec2(iTime * 0.5 + rand(34), 0.0)) * 5.0));
        float glitchWidth;
        float glitchHeight;
        vec2 glitchTopLeft;
        generateRectangle(glitchWidth, glitchHeight, glitchTopLeft, randFrom, 0.2, 0.6, 0.2, 0.2, 0.6, 0.2);

        if (isInRectangle(glitchWidth, glitchHeight, glitchTopLeft, fragCoord)) {
          colorOut = newColor;
        }
      }
    }
  }

  fragColor = vec4(colorOut, 1.0);
}
