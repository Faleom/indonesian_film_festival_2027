/**
 * Halftone 3D camera: renders a model offscreen, then the halftone pass
 * prints it as riso dots in the current theme colours.
 *
 * Interaction: rotates toward the pointer; scroll position turns it and
 * drives the dot size (big dots entering the screen, finer at the centre).
 * Renders only while on screen; dispose() frees every GPU resource.
 */
import { AmbientLight, Box3, DirectionalLight, Group, PerspectiveCamera, Scene, Vector3, type Object3D } from 'three';
import { buildCameraModel } from './cameraModel';
import { createHalftonePass, createRenderer, cssVar, disposeObject, releaseRenderer, setInk } from './post';

export interface SceneOptions {
  /** URL of a GLB to use instead of the primitive camera. */
  modelUrl?: string;
  /** Base dot size in CSS px; scroll scales it. */
  dotSize?: number;
  /** Fixed pose, black ink, no grain/key plate, readable canvas (fallback export). */
  exportMode?: boolean;
}

export interface SceneHandle {
  setDotSize?(px: number): void;
  setActive(active: boolean): void;
  refreshColours(): void;
  dispose(): void;
}

export async function mountScene(host: HTMLElement, opts: SceneOptions = {}): Promise<SceneHandle> {
  const { exportMode = false } = opts;
  let baseDot = opts.dotSize ?? 9;

  // The fallback export renders sharper for a crisp static image.
  const { renderer, canvas, dpr } = createRenderer(host, { preserve: exportMode, forceDpr: exportMode ? 3 : 0 });

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
  pivot.add(await loadModel(opts.modelUrl));

  const pass = createHalftonePass(renderer, dpr, { dotSize: baseDot, keyStrength: exportMode ? 0 : 0.75, grain: exportMode ? 0 : 1 });
  const { uniforms } = pass;

  const refreshColours = () => {
    setInk(uniforms.uInk.value, exportMode ? '#000000' : cssVar(host, '--c-primary'));
    setInk(uniforms.uKey.value, exportMode ? '#000000' : cssVar(host, '--c-dark'));
  };
  refreshColours();

  const resize = () => {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    pass.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

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
    uniforms.uDotSize.value = baseDot * dpr * (1 + Math.abs(p - 0.5) * 2 * 0.9);
    uniforms.uTime.value = t;
    pass.render(scene, camera);
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
      if (active) {
        refreshColours();
        loop();
      }
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
      disposeObject(scene);
      pass.dispose();
      releaseRenderer(renderer, canvas);
    },
  };
}

/** The GLB if provided (centred and scaled to fit), else the primitive camera. */
export async function loadModel(url?: string): Promise<Object3D> {
  if (url) {
    try {
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      const gltf = await new GLTFLoader().loadAsync(url);
      const obj = gltf.scene;
      const box = new Box3().setFromObject(obj);
      const size = box.getSize(new Vector3());
      obj.position.sub(box.getCenter(new Vector3()));
      const wrapper = new Group();
      wrapper.add(obj);
      wrapper.scale.setScalar(3 / Math.max(size.x, size.y, size.z));
      return wrapper;
    } catch (err) {
      console.warn('[halftone-3d] Could not load model, using the placeholder camera.', err);
    }
  }
  return buildCameraModel();
}
