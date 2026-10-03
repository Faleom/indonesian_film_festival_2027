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

export function createRenderer(host: HTMLElement, { preserve = false, maxDpr = 1.5, forceDpr = 0 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'ht3d__canvas';
  canvas.setAttribute('aria-hidden', 'true');
  host.append(canvas);
  const renderer = new WebGLRenderer({
    canvas,
    alpha: true,
    antialias: false,
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
    setSize(width: number, height: number) {
      target.setSize(Math.round(width * dpr), Math.round(height * dpr));
      uniforms.uResolution.value.set(width * dpr, height * dpr);
    },
    render(scene: Object3D, camera: Camera) {
      renderer.setRenderTarget(target);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.clear();
      renderer.render(postScene, postCamera);
    },
    dispose() {
      quad.geometry.dispose();
      (quad.material as ShaderMaterial).dispose();
      target.dispose();
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
