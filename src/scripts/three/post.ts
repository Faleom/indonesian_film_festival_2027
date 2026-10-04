/**
 * Shared WebGL plumbing for the halftone scenes: renderer setup and the
 * halftone post-processing pass (render scene offscreen -> print as dots).
 */
import {
  Color,
  LinearSRGBColorSpace,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
  WebGLRenderer,
  type Camera,
  type Object3D,
} from 'three';
import { halftoneFragment, halftoneVertex } from './halftoneShader';

export const cssVar = (el: Element, name: string) => getComputedStyle(el).getPropertyValue(name).trim();

/** The shaders write raw values, so take hex colours as-is to print exact brand colours. */
export const setInk = (c: Color, value: string) => c.setStyle(value || '#000000', LinearSRGBColorSpace);

export function createRenderer(host: HTMLElement, { preserve = false, maxDpr = 1.5, forceDpr = 0, antialias = false } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'ht3d__canvas';
  canvas.setAttribute('aria-hidden', 'true');
  host.append(canvas);
  const renderer = new WebGLRenderer({
    canvas,
    alpha: true,
    antialias,
    premultipliedAlpha: false,
    preserveDrawingBuffer: preserve,
    powerPreference: 'high-performance',
  });
  renderer.setClearColor(0x000000, 0);
  const dpr = forceDpr || Math.min(window.devicePixelRatio || 1, maxDpr);
  renderer.setPixelRatio(dpr);
  return { renderer, canvas, dpr };
}

export interface HalftonePassOptions {
  dotSize: number; // CSS px
  keyStrength?: number;
  grain?: number;
}

/**
 * The halftone screen only reads the scene's tone at each dot's centre, so the
 * scene is rendered at a few texels per dot instead of full device resolution
 * (e.g. ~1/5 of the pixels on a 2x screen). The printed dots look the same.
 */
const TEXELS_PER_DOT = 4;

export function createHalftonePass(renderer: WebGLRenderer, dpr: number, opts: HalftonePassOptions) {
  const target = new WebGLRenderTarget(1, 1, { depthBuffer: true });
  const uniforms = {
    tScene: { value: target.texture },
    uResolution: { value: new Vector2(1, 1) },
    uDotSize: { value: opts.dotSize * dpr },
    uAngle: { value: Math.PI / 4 },
    uInk: { value: new Color() },
    uKey: { value: new Color() },
    uKeyStrength: { value: opts.keyStrength ?? 0.75 },
    uMisregister: { value: new Vector2(3 * dpr, -2 * dpr) },
    uGrain: { value: opts.grain ?? 1 },
    uTime: { value: 0 },
    uTone: { value: 1 },
  };
  const quad = new Mesh(
    new PlaneGeometry(2, 2),
    new ShaderMaterial({ vertexShader: halftoneVertex, fragmentShader: halftoneFragment, uniforms, transparent: true }),
  );
  const postScene = new Scene();
  postScene.add(quad);
  const postCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  return {
    uniforms,
    setSize(width: number, height: number, pixelRatio = dpr) {
      const scale = Math.min(1, TEXELS_PER_DOT / (opts.dotSize * pixelRatio));
      target.setSize(Math.max(1, Math.round(width * pixelRatio * scale)), Math.max(1, Math.round(height * pixelRatio * scale)));
      uniforms.uResolution.value.set(width * pixelRatio, height * pixelRatio);
    },
    /** clearScreen: false keeps what's already on screen (e.g. a backdrop drawn first). */
    render(scene: Object3D, camera: Camera, clearScreen = true) {
      renderer.setRenderTarget(target);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      if (clearScreen) renderer.clear();
      renderer.render(postScene, postCamera);
    },
    dispose() {
      quad.geometry.dispose();
      (quad.material as ShaderMaterial).dispose();
      target.dispose();
    },
  };
}

/**
 * requestAnimationFrame loop for the 3D scenes:
 *   - capped at maxFps (default 60). On 120/144 Hz screens this halves the GPU
 *     work; the animations are time-based, so motion stays as smooth
 *   - onSlow() fires when the average frame time stays over budget (~45 fps)
 *     for two windows in a row (~2-3 s), so a scene can lower its resolution. Load spikes
 *     (shader compiles, first texture uploads) are ignored: nothing is
 *     measured in the first 2 s after starting. Never fires on devices that
 *     keep up. ?quality=full turns it off (for measuring).
 */
const fixedQuality = typeof location !== 'undefined' && new URLSearchParams(location.search).get('quality') === 'full';

export function frameLoop(render: () => void, { maxFps = 60, onSlow }: { maxFps?: number; onSlow?: () => void } = {}) {
  const interval = 1000 / maxFps;
  const WINDOW = 60; // frames averaged
  let raf = 0;
  let running = false;
  let last = 0; // cadence anchor
  let prevRender = 0; // for measuring real frame times
  let warmUntil = 0;
  let sum = 0;
  let count = 0;
  let slowWindows = 0;
  const tick = (now: number) => {
    if (!running) return;
    raf = requestAnimationFrame(tick);
    const elapsed = now - last;
    if (elapsed < interval - 1) return;
    // Keep the cadence even on 144 Hz (mix of 2- and 3-refresh gaps averages 60).
    // A frame that lands just under the interval (60 Hz jitter) re-anchors at now.
    last = elapsed >= interval ? now - (elapsed % interval) : now;
    const frameTime = now - prevRender;
    prevRender = now;
    if (onSlow && !fixedQuality && now > warmUntil && frameTime < 250) {
      sum += frameTime;
      if (++count >= WINDOW) {
        slowWindows = sum / count > 22 ? slowWindows + 1 : 0;
        if (slowWindows >= 2) {
          onSlow();
          slowWindows = 0;
          warmUntil = now + 1000; // let the new resolution settle before judging again
        }
        sum = count = 0;
      }
    }
    render();
  };
  return {
    start() {
      if (running) return;
      running = true;
      last = performance.now() - interval;
      prevRender = performance.now();
      warmUntil = performance.now() + 2000;
      sum = count = slowWindows = 0;
      raf = requestAnimationFrame(tick);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
  };
}

/** Frees geometries, materials and textures in a scene graph. */
export function disposeObject(root: Object3D) {
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mats = mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : [];
    mats.forEach((m) => {
      Object.values(m).forEach((v) => (v as { isTexture?: boolean })?.isTexture && (v as { dispose(): void }).dispose());
      m.dispose();
    });
  });
}

export function releaseRenderer(renderer: WebGLRenderer, canvas: HTMLCanvasElement) {
  renderer.dispose();
  renderer.forceContextLoss();
  canvas.remove();
}
