/**
 * Full-screen video behind the hero camera, printed onto the paper: dark parts
 * of the video become halftone dots in the theme ink, light parts stay
 * transparent so the crumpled paper shows through (no CSS blend modes, which
 * can't reach the page background from inside the sticky stage).
 *
 * Until the real file exists (media key "hero-bg-video"), a slow procedural
 * pattern stands in so the effect can be judged.
 */
import {
  Color,
  LinearFilter,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  SRGBColorSpace,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector4,
  VideoTexture,
  type WebGLRenderer,
} from 'three';

/** Knobs to play with. */
export const BACKDROP = {
  /** Ink opacity of the video dots. Keep it low so the camera stays the hero. */
  opacity: 0.32,
  /** Halftone cell size, CSS px (bigger on phones, see lite). */
  dot: 6,
  liteDot: 7,
  /** Contrast boost before screening (1 = as filmed). */
  contrast: 1.35,
};

const fragment = /* glsl */ `
  precision highp float;
  uniform sampler2D uMap;
  uniform float uHasMap;
  uniform vec4 uCover;        // xy = scale, zw = offset (object-fit: cover)
  uniform vec2 uResolution;   // device px
  uniform float uCell;        // device px
  uniform float uContrast;
  uniform float uOpacity;
  uniform float uTime;
  uniform vec3 uInk;
  uniform float uTextBand;    // bottom fraction of the screen holding the intro text: no dots there
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  // Stand-in "footage": soft shapes drifting across, like an out-of-focus shot.
  float placeholder(vec2 uv) {
    float aspect = uResolution.x / uResolution.y;
    vec2 p = vec2(uv.x * aspect, uv.y);
    float d = 0.0;
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      vec2 c = vec2(fract(0.15 + fi * 0.31 + uTime * (0.012 + fi * 0.004)) * (aspect + 0.6) - 0.3,
                    0.55 + sin(uTime * 0.21 + fi * 1.7) * 0.25);
      d += exp(-dot(p - c, p - c) / (0.025 + fi * 0.012)) * (0.9 - fi * 0.12);
    }
    // Shapes with clear edges and empty paper between them.
    return smoothstep(0.12, 0.85, d);
  }

  float darkness(vec2 uv) {
    if (uHasMap < 0.5) return placeholder(uv);
    vec3 c = texture2D(uMap, uv * uCover.xy + uCover.zw).rgb;
    float lum = pow(dot(c, vec3(0.299, 0.587, 0.114)), 1.0 / 2.2);
    return clamp((1.0 - lum - 0.5) * uContrast + 0.5, 0.0, 1.0);
  }

  void main() {
    vec2 px = vUv * uResolution;
    // 45 deg screen, fixed to the screen (the backdrop doesn't move).
    vec2 p = mat2(0.7071, -0.7071, 0.7071, 0.7071) * px / uCell;
    vec2 cell = floor(p);
    vec2 centre = (mat2(0.7071, 0.7071, -0.7071, 0.7071) * ((cell + 0.5) * uCell)) / uResolution;
    float d = darkness(clamp(centre, 0.0, 1.0));
    d = clamp(d + (hash(cell) - 0.5) * 0.08, 0.0, 1.0);
    // Fade out over the text band at the bottom so the intro stays clean.
    d *= smoothstep(uTextBand, uTextBand + 0.15, vUv.y);
    if (d < 0.04) discard;
    float r = 0.72 * sqrt(d);
    float dist = length(fract(p) - 0.5);
    float aa = fwidth(dist);
    float cov = smoothstep(r + aa, r - aa, dist);
    if (cov < 0.01) discard;
    gl_FragColor = vec4(uInk, cov * uOpacity);
  }
`;

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export function createBackdrop(src: string | undefined, dpr: number, lite: boolean) {
  const uniforms = {
    uMap: { value: null as VideoTexture | null },
    uHasMap: { value: 0 },
    uCover: { value: new Vector4(1, 1, 0, 0) },
    uResolution: { value: new Vector2(1, 1) },
    uCell: { value: (lite ? BACKDROP.liteDot : BACKDROP.dot) * dpr },
    uContrast: { value: BACKDROP.contrast },
    uOpacity: { value: BACKDROP.opacity },
    uTime: { value: 0 },
    uInk: { value: new Color() },
    uTextBand: { value: 0.2 },
  };

  const material = new ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, uniforms, transparent: true, depthTest: false, depthWrite: false });
  const quad = new Mesh(new PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const scene = new Scene();
  scene.add(quad);
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  let video: HTMLVideoElement | undefined;
  let videoAspect = 16 / 9;
  let screenAspect = 1;
  const fitCover = () => {
    // Scale the uv window so the video covers the screen, centred.
    const sx = videoAspect > screenAspect ? screenAspect / videoAspect : 1;
    const sy = videoAspect > screenAspect ? 1 : videoAspect / screenAspect;
    uniforms.uCover.value.set(sx, sy, (1 - sx) / 2, (1 - sy) / 2);
  };

  if (src) {
    video = document.createElement('video');
    Object.assign(video, { src, muted: true, loop: true, playsInline: true, autoplay: true, preload: 'auto' });
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    // 'playing', not 'loadeddata': with autoplay blocked (iOS Low Power Mode)
    // the video loads but never plays, and the moving placeholder stays.
    video.addEventListener(
      'playing',
      () => {
        const tex = new VideoTexture(video!);
        tex.colorSpace = SRGBColorSpace;
        tex.minFilter = tex.magFilter = LinearFilter;
        uniforms.uMap.value = tex;
        uniforms.uHasMap.value = 1;
        videoAspect = video!.videoWidth / video!.videoHeight || 16 / 9;
        fitCover();
      },
      { once: true },
    );
    video.addEventListener('error', () => console.warn(`[hero] Background video failed: ${src}`), { once: true });
  }

  return {
    ink: uniforms.uInk.value,
    /** Fraction of the screen height (from the bottom) taken by the intro text. */
    setTextBand(fraction: number) {
      uniforms.uTextBand.value = Math.min(0.8, Math.max(0, fraction));
    },
    setSize(width: number, height: number, pixelRatio: number) {
      uniforms.uCell.value = (lite ? BACKDROP.liteDot : BACKDROP.dot) * pixelRatio;
      uniforms.uResolution.value.set(width * pixelRatio, height * pixelRatio);
      screenAspect = width / height;
      fitCover();
    },
    /** fade: 0..1 multiplier on the ink opacity. */
    render(renderer: WebGLRenderer, t: number, fade: number) {
      uniforms.uTime.value = t;
      uniforms.uOpacity.value = BACKDROP.opacity * fade;
      if (fade <= 0.001) return;
      renderer.render(scene, camera);
    },
    setPlaying(on: boolean) {
      if (!video) return;
      if (on) video.play().catch(() => {});
      else video.pause();
    },
    dispose() {
      if (video) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
      uniforms.uMap.value?.dispose();
      quad.geometry.dispose();
      material.dispose();
    },
  };
}
