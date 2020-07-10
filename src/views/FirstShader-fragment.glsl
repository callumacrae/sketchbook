  precision mediump float;

  #pragma glslify: noise3d = require('glsl-noise/simplex/3d');
  #pragma glslify: hsl2rgb = require('glsl-hsl2rgb');

  uniform float u_aspect;
  uniform float u_time;
  varying vec2 vUv;

  void main() {
    vec2 center = vUv - 0.5;
    center.x *= u_aspect;

    float dist = length(center);

    float mask = smoothstep(0.2025, 0.2, dist);

    float time = u_time / 4000.0;

    vec2 q = vUv;
    q.x *= u_aspect;

    float h = noise3d(vec3(q / 2.0, time)) * 0.25 +
      noise3d(vec3(gl_FragCoord.xy / 4.0, time)) * 0.01;
    float s = 0.6 + noise3d(vec3(gl_FragCoord.xy / 4.0, time)) * 0.05;
    float l = 0.5;

    vec3 color = hsl2rgb(h, s, l);
    gl_FragColor = vec4(color, mask);
  }
