/**
 * Halftone particle shader for the home hero.
 *
 * Every particle has three homes and the scroll morphs between them:
 *   aCam    - a point on the 3D camera's surface (rotated by uRot, shaded by light)
 *   aScatter- a point in an exploded cloud
 *   aTitle  - a point in the festival title (2D, sampled from rendered text)
 * Dot size carries the tone, like a halftone screen. A second draw (uKeyPass)
 * prints the camera's shadows in the theme dark, slightly out of register.
 */
export const particleVertex = /* glsl */ `
  attribute vec3 aCam;
  attribute vec3 aCamNormal;
  attribute float aCamTone;
  attribute vec3 aScatter;
  attribute vec2 aTitle;
  attribute float aTitleSize;
  attribute float aScript;
  attribute float aRand;

  uniform mat3 uRot;
  uniform float uCamScale;
  uniform float uTitleHalf;      // world half-width of the title
  uniform vec2 uTitleOffset;
  uniform float uExplode;        // 0..1
  uniform float uAssemble;       // 0..1
  uniform float uSpin;           // scatter cloud rotation
  uniform float uDotPx;          // camera/scatter dot diameter, device px
  uniform float uTitleDotPx;     // title dot diameter, device px
  uniform float uRefDepth;       // camera distance, for perspective sizing
  uniform float uKeyPass;
  uniform vec2 uMisregister;     // device px
  uniform vec2 uResolution;      // device px
  uniform float uTime;

  varying float vScript;

  // Per-particle stagger so the morph ripples instead of moving in lockstep.
  float stagger(float t, float r) {
    return smoothstep(r * 0.4, r * 0.4 + 0.6, t);
  }

  void main() {
    vec3 cam = uRot * (aCam * uCamScale);
    vec3 n = normalize(uRot * aCamNormal);
    float lit = clamp(dot(n, normalize(vec3(0.45, 0.75, 0.6))), 0.0, 1.0);
    float dark = clamp(1.15 - aCamTone * 0.75 - lit * 0.7, 0.0, 1.0);

    float e = stagger(uExplode, aRand);
    float a = stagger(uAssemble, fract(aRand * 7.31));

    // Exploded cloud slowly spins and breathes.
    float ang = uSpin + aRand * 0.6;
    vec3 sc = vec3(aScatter.x * cos(ang) - aScatter.z * sin(ang), aScatter.y, aScatter.x * sin(ang) + aScatter.z * cos(ang));
    sc += vec3(sin(uTime * 0.7 + aRand * 40.0), cos(uTime * 0.6 + aRand * 31.0), 0.0) * 0.12;

    vec3 title = vec3(aTitle * uTitleHalf + uTitleOffset, 0.0);
    vec3 pos = mix(mix(cam, sc, e), title, a);

    float camSize = mix(0.22, 1.0, dark) * uDotPx;
    float scatterSize = (0.25 + aRand * 0.5) * uDotPx;
    float titleSize = aTitleSize * uTitleDotPx;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    float persp = uRefDepth / max(-mv.z, 0.1);
    float size = mix(mix(camSize * persp, scatterSize * persp, e), titleSize, a);

    if (uKeyPass > 0.5) {
      // Key plate: only the camera's front-facing shadows, gone once it explodes.
      size *= step(0.6, dark) * step(0.15, n.z) * (1.0 - e);
    }

    gl_Position = projectionMatrix * mv;
    if (uKeyPass > 0.5) gl_Position.xy += uMisregister / uResolution * 2.0 * gl_Position.w;
    gl_PointSize = size;
    vScript = aScript * a;
  }
`;

export const particleFragment = /* glsl */ `
  precision highp float;
  uniform vec3 uInk;
  uniform vec3 uKey;
  uniform vec3 uScriptInk;
  uniform float uKeyPass;
  uniform float uTime;
  varying float vScript;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    float d = length(gl_PointCoord - 0.5);
    float alpha = 1.0 - smoothstep(0.4, 0.5, d);
    if (alpha < 0.02) discard;
    vec3 colour = uKeyPass > 0.5 ? uKey : mix(uInk, uScriptInk, step(0.5, vScript));
    // Ink grain, re-rolled ~12 times a second.
    alpha *= 0.82 + 0.18 * hash(gl_FragCoord.xy + floor(uTime * 12.0));
    gl_FragColor = vec4(colour, alpha * (uKeyPass > 0.5 ? 0.85 : 1.0));
  }
`;
