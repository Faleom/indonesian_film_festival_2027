/**
 * EXPERIMENT: "solid" look for the 3D film strip (classic = screen-space
 * halftone post-pass, see filmStrip.ts).
 *
 * Instead of printing the whole rendered scene as dots on a fixed screen grid
 * (which shimmers as frames move under it), every surface prints itself:
 *   - pictures: riso duotone with the halftone screen locked to the image,
 *     so dots travel with the frame and the picture stays readable
 *   - film border: solid ink in the theme dark, over a misregistered
 *     primary plate peeking out at the edges
 * Grain is fixed to the surface too (no flicker). Scrolling fast still runs
 * the riso "too hot": coarser dots, plates slipping out of register.
 */
import { Color, DoubleSide, Matrix3, ShaderMaterial, Vector2, type Camera, type Scene, type Texture, type WebGLRenderer } from 'three';

/** Knobs to play with. */
export const STRIP_SOLID = {
  /** Halftone cells across a picture's width. Higher = finer dots, more readable image. */
  cells: 100,
  /** 0 = smooth duotone (no dots), 1 = full halftone dots. */
  dots: 1,
  /** Shadow plate (theme dark) strength in pictures. 0 = single colour. */
  keyStrength: 0.65,
  /** Ink speckle, 0..1. Fixed to the surface, so it doesn't flicker. */
  grain: 0.5,
  /** Plate offset at rest / extra when scrolling fast, in uv units (1 = a whole frame). */
  misregister: 0.006,
  misregisterSpeed: 0.06,
  /** How much fast scrolling coarsens the dots (classic: 0.9). */
  speedCoarsen: 0.9,
};

const common = /* glsl */ `
  uniform vec3 uInk;
  uniform vec3 uKey;
  uniform vec2 uMis;       // plate offset, uv units of this surface
  uniform float uGrain;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  // Perceptual darkness of a linear-light texel (0 = white paper, 1 = full ink).
  float darkOf(vec4 c) {
    return (1.0 - pow(clamp(dot(c.rgb, vec3(0.299, 0.587, 0.114)), 0.0, 1.0), 1.0 / 2.2)) * c.a;
  }

  // Two inks overprinting: a1 = colour plate, a2 = key plate.
  vec4 overprint(float a1, float a2) {
    float alpha = 1.0 - (1.0 - a1) * (1.0 - a2);
    vec3 rgb = (a1 * (1.0 - a2) * uInk + a2 * (1.0 - a1) * uKey + a1 * a2 * uInk * uKey) / max(alpha, 1e-4);
    return vec4(rgb, alpha);
  }
`;

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const pictureFragment = /* glsl */ `
  precision highp float;
  ${common}
  uniform sampler2D uMap;
  uniform mat3 uMapTransform;  // texture.matrix (cover-fit crop)
  uniform float uCells;        // halftone cells across the width
  uniform float uAspect;       // picture width / height
  uniform float uDots;
  uniform float uKeyStrength;

  float dark(vec2 uv) {
    vec2 st = (uMapTransform * vec3(clamp(uv, 0.0, 1.0), 1.0)).xy;
    return darkOf(texture2D(uMap, st));
  }

  // Amplitude-modulated screen at 45 deg, locked to the picture. Each cell's
  // dot grows with darkness until neighbours merge. Fades to smooth tone when
  // cells get smaller than ~2px (far away), so it never moires.
  float screen(float d, vec2 uv, float seed) {
    vec2 p = uv * vec2(uCells, uCells / uAspect);
    p = mat2(0.7071, -0.7071, 0.7071, 0.7071) * p;
    vec2 cell = floor(p);
    float dist = length(fract(p) - 0.5);
    d = clamp(d + (hash(cell + seed) - 0.5) * 0.1 * uGrain, 0.0, 1.0);
    float f = d - (dist / 0.72) * (dist / 0.72);
    float dotCov = clamp(f / max(fwidth(f), 1e-4) + 0.5, 0.0, 1.0);
    float cellPx = 1.0 / max(fwidth(p.x), 1e-4);
    float amount = uDots * smoothstep(2.0, 4.0, cellPx);
    return mix(d, dotCov, amount);
  }

  void main() {
    float a1 = screen(smoothstep(0.03, 1.0, dark(vUv)), vUv, 0.0);
    float a2 = uKeyStrength > 0.0
      ? screen(smoothstep(0.62, 1.0, dark(vUv + uMis)), vUv + uMis, 17.0) * uKeyStrength
      : 0.0;
    vec4 c = overprint(a1, a2);
    // Paper speckle: tiny gaps in the ink, fixed to the surface.
    c.a *= 1.0 - uGrain * 0.22 * step(0.72, hash(floor(vUv * vec2(700.0, 700.0 / uAspect))));
    if (c.a < 0.01) discard;
    gl_FragColor = c;
  }
`;

const borderFragment = /* glsl */ `
  precision highp float;
  ${common}
  uniform sampler2D uMap;

  float ink(vec2 uv) {
    vec4 c = texture2D(uMap, uv);
    return smoothstep(0.35, 0.65, darkOf(c));
  }

  void main() {
    float a2 = ink(vUv);              // film: theme dark
    float a1 = ink(vUv - uMis) * 0.9; // colour plate, out of register
    vec4 c = overprint(a1, a2);
    c.a *= 1.0 - uGrain * 0.3 * step(0.7, hash(floor(vUv * vec2(900.0, 730.0))));
    if (c.a < 0.01) discard;
    gl_FragColor = c;
  }
`;

export function createSolidLook() {
  const shared = {
    uInk: { value: new Color() },
    uKey: { value: new Color() },
    uMis: { value: new Vector2() },
    uGrain: { value: STRIP_SOLID.grain },
  };
  const cells = { value: STRIP_SOLID.cells };
  const materials: ShaderMaterial[] = [];
  const make = (fragmentShader: string, extra: Record<string, { value: unknown }>) => {
    const m = new ShaderMaterial({
      vertexShader: vertex,
      fragmentShader,
      uniforms: { ...shared, ...extra },
      transparent: true,
      side: DoubleSide,
    });
    materials.push(m);
    return m;
  };

  return {
    ink: shared.uInk.value,
    key: shared.uKey.value,
    antialias: true,
    borderMaterial(tex: Texture) {
      return make(borderFragment, { uMap: { value: tex } });
    },
    pictureMaterial(aspect: number) {
      return make(pictureFragment, {
        uMap: { value: null },
        uMapTransform: { value: new Matrix3() },
        uCells: cells,
        uAspect: { value: aspect },
        uDots: { value: STRIP_SOLID.dots },
        uKeyStrength: { value: STRIP_SOLID.keyStrength },
      });
    },
    setPictureMap(mat: ShaderMaterial, tex: Texture) {
      tex.updateMatrix();
      mat.uniforms.uMap.value = tex;
      mat.uniforms.uMapTransform.value.copy(tex.matrix);
    },
    update(speed: number) {
      const m = STRIP_SOLID.misregister + speed * STRIP_SOLID.misregisterSpeed;
      shared.uMis.value.set(m, -m * 0.7);
      cells.value = STRIP_SOLID.cells / (1 + speed * STRIP_SOLID.speedCoarsen);
    },
    setSize() {},
    render(renderer: WebGLRenderer, scene: Scene, camera: Camera) {
      renderer.setRenderTarget(null);
      renderer.clear();
      renderer.render(scene, camera);
    },
    dispose() {
      materials.forEach((m) => m.dispose());
    },
  };
}
