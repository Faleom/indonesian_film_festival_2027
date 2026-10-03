/**
 * Halftone 3D scene: renders a model to an offscreen target, then a
 * full-screen pass prints it as riso dots in the current theme colours.
 *
 * Interaction: rotates toward the pointer; scroll position turns it and
 * drives the dot size (big dots entering the screen, finer at the centre).
 * Renders only while on screen; dispose() frees every GPU resource.
 */
import {
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  Group,
  LinearSRGBColorSpace,
  Material,
  Mesh,
  Object3D,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  WebGLRenderer,
} from 'three';
import { halftoneFragment, halftoneVertex } from './halftoneShader';
import { buildCameraModel } from './cameraModel';

export interface SceneOptions {
  /** URL of a GLB to use instead of the primitive camera. */
  modelUrl?: string;
  /** Base dot size in CSS px; scroll scales it. */
  dotSize?: number;
  /** Fixed pose, black ink, no grain/key plate, readable canvas (fallback export). */
  exportMode?: boolean;
}

export interface SceneHandle {
  setDotSize(px: number): void;
  setActive(active: boolean): void;
  refreshColours(): void;
  dispose(): void;
}

const css = (el: Element, name: string) => getComputedStyle(el).getPropertyValue(name).trim();

export async function mountScene(host: HTMLElement, opts: SceneOptions = {}): Promise<SceneHandle> {
  const { exportMode = false } = opts;
  let baseDot = opts.dotSize ?? 9;

  const canvas = document.createElement('canvas');
  canvas.className = 'ht3d__canvas';
  canvas.setAttribute('aria-hidden', 'true');
  host.append(canvas);

  const renderer = new WebGLRenderer({
    canvas,
    alpha: true,
    antialias: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: exportMode,
    powerPreference: 'low-power',
  });
  renderer.setClearColor(0x000000, 0);
  // Capped for performance; the fallback export renders sharper for a crisp static image.
  const dpr = exportMode ? 3 : Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(dpr);

  // ---- 3D scene ----
  const scene = new Scene();
  const camera = new PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0.4, 9);
  scene.add(new AmbientLight(0xffffff, 0.55));
  const key = new DirectionalLight(0xffffff, 2.2);
  key.position.set(4, 6, 5);
  scene.add(key);
  const rim = new DirectionalLight(0xffffff, 0.6);
  rim.position.set(-5, 2, -4);
  scene.add(rim);

  const pivot = new Group();
  scene.add(pivot);
  let model: Object3D = buildCameraModel();
  if (opts.modelUrl) {
    try {
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      const gltf = await new GLTFLoader().loadAsync(opts.modelUrl);
      model = normaliseModel(gltf.scene);
    } catch (err) {
      console.warn('[halftone-3d] Could not load model, using the placeholder camera.', err);
    }
  }
  pivot.add(model);

  // ---- Halftone pass ----
  const target = new WebGLRenderTarget(1, 1, { depthBuffer: true });
  const uniforms = {
    tScene: { value: target.texture },
    uResolution: { value: new Vector2(1, 1) },
    uDotSize: { value: baseDot * dpr },
    uAngle: { value: Math.PI / 4 },
    uInk: { value: new Color() },
    uKey: { value: new Color() },
    uKeyStrength: { value: exportMode ? 0 : 0.75 },
    uMisregister: { value: new Vector2(3 * dpr, -2 * dpr) },
    uGrain: { value: exportMode ? 0 : 1 },
    uTime: { value: 0 },
  };
  const post = new Mesh(
    new PlaneGeometry(2, 2),
    new ShaderMaterial({ vertexShader: halftoneVertex, fragmentShader: halftoneFragment, uniforms, transparent: true }),
  );
  const postScene = new Scene();
  postScene.add(post);
  const postCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // The shader writes raw values to the canvas, so take the hex colours as-is
  // (no sRGB -> linear conversion) to print the exact brand colours.
  const setInk = (c: Color, value: string) => c.setStyle(value || '#000000', LinearSRGBColorSpace);
  const refreshColours = () => {
    setInk(uniforms.uInk.value, exportMode ? '#000000' : css(host, '--c-primary'));
    setInk(uniforms.uKey.value, exportMode ? '#000000' : css(host, '--c-dark'));
  };
  refreshColours();

  const resize = () => {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    target.setSize(Math.round(width * dpr), Math.round(height * dpr));
    uniforms.uResolution.value.set(width * dpr, height * dpr);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  // ---- Interaction ----
  const pointer = { x: 0, y: 0 };
  const rot = { x: 0, y: 0 };
  const onPointer = (e: PointerEvent) => {
    pointer.x = (e.clientX / innerWidth) * 2 - 1;
    pointer.y = (e.clientY / innerHeight) * 2 - 1;
  };
  if (!exportMode) window.addEventListener('pointermove', onPointer, { passive: true });

  /** 0 when the host enters from below, 1 when it leaves at the top. */
  const scrollProgress = () => {
    const r = host.getBoundingClientRect();
    return Math.min(1, Math.max(0, (innerHeight - r.top) / (innerHeight + r.height)));
  };

  let active = false;
  let frame = 0;
  const startTime = performance.now();

  const render = () => {
    const t = (performance.now() - startTime) / 1000;
    const p = exportMode ? 0.5 : scrollProgress();
    // Scroll turns the camera; pointer adds a tilt; a slow idle drift keeps it alive.
    const targetY = -0.85 + (p - 0.5) * 1.6 + pointer.x * 0.45 + (exportMode ? 0 : Math.sin(t * 0.4) * 0.08);
    const targetX = 0.28 + pointer.y * 0.25;
    rot.y += (targetY - rot.y) * (exportMode ? 1 : 0.08);
    rot.x += (targetX - rot.x) * (exportMode ? 1 : 0.08);
    pivot.rotation.set(rot.x, rot.y, 0);

    // Dots are biggest at the screen edges and finest when centred.
    const edge = Math.abs(p - 0.5) * 2;
    uniforms.uDotSize.value = baseDot * dpr * (1 + edge * 0.9);
    uniforms.uTime.value = t;

    renderer.setRenderTarget(target);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.clear();
    renderer.render(postScene, postCamera);
  };

  const loop = () => {
    if (!active) return;
    render();
    frame = requestAnimationFrame(loop);
  };

  render(); // first frame right away, so the fallback can be swapped out

  return {
    setDotSize(px) {
      baseDot = px;
      if (!active) render();
    },
    setActive(next) {
      if (next === active) return;
      active = next;
      if (active) loop();
      else cancelAnimationFrame(frame);
    },
    refreshColours() {
      refreshColours();
      if (!active) render();
    },
    dispose() {
      active = false;
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onPointer);
      ro.disconnect();
      scene.traverse((o) => {
        if (o instanceof Mesh) {
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
        }
      });
      post.geometry.dispose();
      (post.material as Material).dispose();
      target.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}

/** Centres and scales an imported model to roughly the placeholder's size. */
function normaliseModel(obj: Object3D): Object3D {
  const box = new Box3().setFromObject(obj);
  const size = box.getSize(new Vector3());
  const scale = 3 / Math.max(size.x, size.y, size.z);
  const centre = box.getCenter(new Vector3());
  const wrapper = new Group();
  obj.position.sub(centre);
  wrapper.add(obj);
  wrapper.scale.setScalar(scale);
  return wrapper;
}
