/**
 * Halftone post-processing: turns the rendered scene into riso-style dots.
 *
 * Two "plates", like a two-colour risograph print:
 *   1. colour plate: theme primary, dot area follows darkness
 *   2. key plate: theme dark, only in the shadows, offset by uMisregister
 * Output is transparent where there's no ink, so the page's paper shows through.
 * Empty background (alpha 0 in the scene render) prints nothing.
 */
export const halftoneVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const halftoneFragment = /* glsl */ `
  precision highp float;

  uniform sampler2D tScene;
  uniform vec2 uResolution;   // canvas size in device pixels
  uniform float uDotSize;     // grid spacing in device pixels (scroll drives this)
  uniform float uAngle;       // screen angle, radians
  uniform vec3 uInk;          // colour plate (theme primary)
  uniform vec3 uKey;          // key plate (theme dark)
  uniform float uKeyStrength; // 0 = single-colour print
  uniform vec2 uMisregister;  // key plate offset in device pixels
  uniform float uGrain;       // 0..1
  uniform float uTime;
  uniform float uTone;        // 1 = normal, 0 = no ink (dots shrink away)

  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  // Darkness of the scene at a pixel position; empty background counts as white.
  float darkness(vec2 px) {
    vec4 c = texture2D(tScene, clamp(px / uResolution, 0.0, 1.0));
    // The scene renders in linear light; convert to perceptual brightness so
    // mid-greys print as mid-sized dots instead of near-solid ink.
    float lum = pow(dot(c.rgb, vec3(0.299, 0.587, 0.114)), 1.0 / 2.2);
    return (1.0 - lum) * c.a * uTone;
  }

  // Coverage (0..1) of the halftone screen at this pixel. Checks the 3x3
  // neighbouring dots so large dots in dark areas merge cleanly.
  float screen(vec2 px, float lo, float hi, float seed) {
    mat2 rot = mat2(cos(uAngle), sin(uAngle), -sin(uAngle), cos(uAngle));
    mat2 inv = mat2(cos(uAngle), -sin(uAngle), sin(uAngle), cos(uAngle));
    vec2 q = rot * px;
    vec2 cell = floor(q / uDotSize + 0.5);
    float cov = 0.0;
    for (int i = -1; i <= 1; i++) {
      for (int j = -1; j <= 1; j++) {
        vec2 c = (cell + vec2(float(i), float(j))) * uDotSize;
        float d = darkness(inv * c);
        // Grain: jitter each dot's tone a little, re-rolled ~12 times a second.
        d += (hash(cell + vec2(float(i), float(j)) + seed + floor(uTime * 12.0)) - 0.5) * 0.12 * uGrain;
        d = smoothstep(lo, hi, d);
        float r = uDotSize * 0.72 * sqrt(max(d, 0.0));
        cov = max(cov, clamp(r - length(q - c) + 0.5, 0.0, 1.0));
      }
    }
    return cov;
  }

  void main() {
    vec2 px = vUv * uResolution;
    float a1 = screen(px, 0.04, 1.0, 0.0);
    float a2 = uKeyStrength > 0.0 ? screen(px + uMisregister, 0.68, 1.0, 17.0) * uKeyStrength : 0.0;

    // Inks multiply where they overlap, like real overprinting.
    vec3 ink1 = mix(vec3(1.0), uInk, step(0.001, a1));
    vec3 ink2 = mix(vec3(1.0), uKey, step(0.001, a2));
    vec3 rgb = ink1 * ink2;
    float alpha = 1.0 - (1.0 - a1) * (1.0 - a2);

    // Paper grain: a little speckle in the ink.
    alpha *= 1.0 - uGrain * 0.18 * hash(gl_FragCoord.xy + floor(uTime * 12.0));

    gl_FragColor = vec4(rgb, alpha);
  }
`;
