/**
 * Home hero: a 3D film camera made of halftone dots. Scrolling through the
 * pinned hero rotates it, blows the dots apart, then reassembles them into
 * the festival title (sampled from the real display + script fonts).
 *
 * Scroll map (p = progress through the pinned section, 0..1):
 *   0.00-0.30  camera turns, dots grow
 *   0.24-0.55  explode into a spinning cloud
 *   0.50-0.85  assemble into the title
 *   0.85-1.00  hold
 */
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Euler,
  Float32BufferAttribute,
  Group,
  Matrix3,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  NormalBlending,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  type Object3D,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js';
import { particleFragment, particleVertex } from './particleShader';
import { createRenderer, cssVar, ease, frameLoop, releaseRenderer, setInk } from './post';
import { loadModel, type SceneHandle } from './scene';

export interface HeroOptions {
  modelUrl?: string;
  /** Title lines, e.g. ["Indonesian", "Film Festival"]. */
  lines: string[];
  /** Script word drawn across the first line break, e.g. "the 21st". */
  script?: string;
  /** Phones/tablets: fewer particles, lower resolution. */
  lite?: boolean;
  /** Solid variant: background video printed behind the camera (undefined = placeholder pattern). */
  bgVideo?: string;
  /** Upper bound on the pixel ratio (low-end devices start lower). */
  maxDpr?: number;
}

export const CAMERA_DISTANCE = 12;
export const FOV = 35;
export const TARGET_POINTS = 7500;
export const LITE_POINTS = 4000;

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const smooth = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export async function mountHero(host: HTMLElement, opts: HeroOptions): Promise<SceneHandle> {
  const stage = (host.querySelector('[data-hero-stage]') as HTMLElement) ?? host;
  const target = opts.lite ? LITE_POINTS : TARGET_POINTS;
  const [model, title] = await Promise.all([loadModel(opts.modelUrl), sampleTitle(opts.lines, opts.script, target)]);

  const count = Math.max(target, title.count);
  const cam = sampleModel(model, count);
  disposeModel(model);

  // ---- Geometry: three homes per particle ----
  const geometry = new BufferGeometry();
  const scatter = new Float32Array(count * 3);
  const titlePos = new Float32Array(count * 2);
  const titleSize = new Float32Array(count);
  const script = new Float32Array(count);
  const rand = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const u = Math.random() * 2 - 1;
    const th = Math.random() * Math.PI * 2;
    const r = 2.4 + Math.sqrt(Math.random()) * 4.6;
    const s = Math.sqrt(1 - u * u);
    // Wide and deep rather than tall, so the cloud doesn't bury the text below.
    scatter.set([s * Math.cos(th) * r * 1.5, u * r * 0.65 + 0.6, s * Math.sin(th) * r * 1.6 - 1], i * 3);
    rand[i] = Math.random();
    // Extra particles beyond the title's own count collapse invisibly into it.
    const t = i < title.count ? i : Math.floor(Math.random() * title.count);
    titlePos.set([title.points[t * 2], title.points[t * 2 + 1]], i * 2);
    titleSize[i] = i < title.count ? title.sizes[t] : 0;
    script[i] = title.script[t];
  }
  geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute('aCam', new BufferAttribute(cam.positions, 3));
  geometry.setAttribute('aCamNormal', new BufferAttribute(cam.normals, 3));
  geometry.setAttribute('aCamTone', new BufferAttribute(cam.tones, 1));
  geometry.setAttribute('aScatter', new BufferAttribute(scatter, 3));
  geometry.setAttribute('aTitle', new BufferAttribute(titlePos, 2));
  geometry.setAttribute('aTitleSize', new BufferAttribute(titleSize, 1));
  geometry.setAttribute('aScript', new BufferAttribute(script, 1));
  geometry.setAttribute('aRand', new BufferAttribute(rand, 1));

  const { renderer, canvas, dpr } = createRenderer(stage, { maxDpr: opts.maxDpr ?? (opts.lite ? 1.5 : 2) });
  const uniforms = {
    uRot: { value: new Matrix3() },
    uCamScale: { value: 1 },
    uCamOffset: { value: new Vector3() },
    uTitleHalf: { value: 1 },
    uTitleOffset: { value: new Vector2() },
    uExplode: { value: 0 },
    uAssemble: { value: 0 },
    uSpin: { value: 0 },
    uDotPx: { value: 7 * dpr },
    uTitleDotPx: { value: 6 * dpr },
    uRefDepth: { value: CAMERA_DISTANCE },
    uKeyPass: { value: 0 },
    uMisregister: { value: new Vector2(3 * dpr, -2.5 * dpr) },
    uBreath: { value: 0.12 },
    uGrainFps: { value: 12 },
    uResolution: { value: new Vector2(1, 1) },
    uTime: { value: 0 },
    uInk: { value: new Color() },
    uKey: { value: new Color() },
    uScriptInk: { value: new Color() },
  };
  const colourMat = new ShaderMaterial({
    vertexShader: particleVertex,
    fragmentShader: particleFragment,
    uniforms,
    transparent: true,
    depthTest: true,
    depthWrite: true,
    blending: NormalBlending,
  });
  const keyMat = colourMat.clone();
  keyMat.uniforms = { ...uniforms, uKeyPass: { value: 1 } };
  keyMat.depthTest = false;
  keyMat.depthWrite = false;

  const scene = new Scene();
  const group = new Group();
  const colourPoints = new Points(geometry, colourMat);
  const keyPoints = new Points(geometry, keyMat);
  keyPoints.renderOrder = 1;
  colourPoints.frustumCulled = keyPoints.frustumCulled = false;
  group.add(colourPoints, keyPoints);
  const shadowMat = addScriptShadow(geometry, colourMat, uniforms, group);
  scene.add(group);
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.set(0, 0, CAMERA_DISTANCE);

  const refreshColours = () => {
    setInk(uniforms.uInk.value, cssVar(host, '--c-primary'));
    setInk(uniforms.uKey.value, cssVar(host, '--c-dark'));
    // Beige/gold script, a touch deeper so the dots read on the paper.
    setInk(uniforms.uScriptInk.value, cssVar(host, '--c-beige'));
    uniforms.uScriptInk.value.multiplyScalar(0.8);
  };
  refreshColours();

  let pxPerWorld = 1;
  const resize = () => {
    const { width, height } = stage.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    uniforms.uResolution.value.set(width * dpr, height * dpr);
    const halfH = CAMERA_DISTANCE * Math.tan((FOV * Math.PI) / 360);
    const halfW = halfH * camera.aspect;
    pxPerWorld = (height * dpr) / 2 / halfH;
    // Title fills most of the width, sits a little above centre (overlay text below).
    const titleHalf = Math.min(halfW * 0.84, (halfH * 0.6) / title.aspect);
    uniforms.uTitleHalf.value = titleHalf;
    uniforms.uTitleOffset.value.set(0, halfH * 0.14);
    uniforms.uTitleDotPx.value = title.step * titleHalf * pxPerWorld * 1.12;
    // Fit the camera to whichever is tighter: screen height, or width (it spins,
    // so use its horizontal radius). Keeps it on screen in narrow/portrait windows.
    uniforms.uCamScale.value = Math.min((halfH * 1.55) / cam.height, (halfW * 0.82) / cam.radius);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(stage);
  resize();

  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  const onPointer = (e: PointerEvent) => {
    pointer.x = (e.clientX / innerWidth) * 2 - 1;
    pointer.y = (e.clientY / innerHeight) * 2 - 1;
  };
  window.addEventListener('pointermove', onPointer, { passive: true });

  /** Progress through the pinned (sticky) hero: 0 at top, 1 when it unpins. */
  const progress = () => {
    const r = host.getBoundingClientRect();
    const span = r.height - stage.offsetHeight; // not innerHeight (iOS toolbar)
    return span > 0 ? clamp01(-r.top / span) : 0;
  };

  const euler = new Euler();
  const m4 = new Matrix4();
  let smoothP = progress();
  let active = false;
  const start = performance.now();

  // Body theme colours animate (registered CSS properties), so after a theme
  // change keep re-reading them until the transition has finished.
  let colourUntil = 0;
  const render = (dt = 1000 / 60) => {
    const t = (performance.now() - start) / 1000;
    if (performance.now() < colourUntil) refreshColours();
    smoothP += (progress() - smoothP) * ease(0.12, dt);
    const p = smoothP;
    pointer.sx += (pointer.x - pointer.sx) * ease(0.06, dt);
    pointer.sy += (pointer.y - pointer.sy) * ease(0.06, dt);

    const turn = smooth(0, 0.3, p);
    euler.set(0.28 + pointer.sy * 0.2, -1.05 + turn * 1.9 + pointer.sx * 0.35 + Math.sin(t * 0.5) * 0.06, 0);
    uniforms.uRot.value.setFromMatrix4(m4.makeRotationFromEuler(euler));
    uniforms.uExplode.value = smooth(0.24, 0.55, p);
    uniforms.uAssemble.value = smooth(0.5, 0.85, p);
    uniforms.uSpin.value = p * 3.2 + t * 0.05;
    uniforms.uDotPx.value = (6 + turn * 3) * dpr;
    uniforms.uTime.value = t;
    group.rotation.set(pointer.sy * 0.05, pointer.sx * 0.1, 0);
    host.style.setProperty('--hero-p', p.toFixed(3));
    decor?.style.setProperty('--mx', pointer.sx.toFixed(3));
    decor?.style.setProperty('--my', pointer.sy.toFixed(3));

    renderer.clear();
    renderer.render(scene, camera);
  };

  const decor = host.querySelector<HTMLElement>('.hero3d__decor');
  const loop = frameLoop(render);
  render();

  return {
    setActive(next) {
      if (next === active) return;
      active = next;
      if (active) {
        // The theme may have changed while off screen.
        refreshColours();
        colourUntil = performance.now() + 900;
        loop.start();
      }
      else loop.stop();
    },
    refreshColours() {
      refreshColours();
      colourUntil = performance.now() + 900;
      if (!active) render();
    },
    dispose() {
      active = false;
      loop.stop();
      window.removeEventListener('pointermove', onPointer);
      ro.disconnect();
      geometry.dispose();
      colourMat.dispose();
      keyMat.dispose();
      shadowMat.dispose();
      releaseRenderer(renderer, canvas);
    },
  };
}

// ---------------------------------------------------------------------------

/**
 * Third draw of the particles: the script word's shadow in the theme dark,
 * out of register, between the title dots and the script dots. Keeps the
 * beige script readable over both the paper and the title ink.
 */
export function addScriptShadow(geometry: BufferGeometry, colourMat: ShaderMaterial, uniforms: object, group: Group) {
  const mat = colourMat.clone();
  mat.uniforms = { ...uniforms, uKeyPass: { value: 2 } };
  mat.depthWrite = true;
  const points = new Points(geometry, mat);
  points.renderOrder = -1;
  points.frustumCulled = false;
  group.add(points);
  return mat;
}

/** Samples points evenly over a model's surface, with normals and a grey tone per part. */
export function sampleModel(model: Object3D, count: number) {
  model.updateMatrixWorld(true);
  const parts: BufferGeometry[] = [];
  model.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const src = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    if (!src.attributes.normal) src.computeVertexNormals();
    src.applyMatrix4(mesh.matrixWorld);
    const g = new BufferGeometry();
    g.setAttribute('position', src.attributes.position);
    g.setAttribute('normal', src.attributes.normal);
    const mat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as MeshStandardMaterial;
    const c = mat?.color ?? new Color(0.5, 0.5, 0.5);
    const tone = c.r * 0.299 + c.g * 0.587 + c.b * 0.114;
    g.setAttribute('color', new Float32BufferAttribute(new Float32Array(src.attributes.position.count * 3).fill(tone), 3));
    parts.push(g);
  });
  const merged = mergeGeometries(parts)!;
  const sampler = new MeshSurfaceSampler(new Mesh(merged)).build();
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const tones = new Float32Array(count);
  const p = new Vector3();
  const n = new Vector3();
  const c = new Color();
  let minY = Infinity;
  let radius = 0;
  let maxY = -Infinity;
  for (let i = 0; i < count; i++) {
    sampler.sample(p, n, c);
    positions.set([p.x, p.y, p.z], i * 3);
    normals.set([n.x, n.y, n.z], i * 3);
    tones[i] = c.r;
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
    radius = Math.max(radius, Math.hypot(p.x, p.z));
  }
  merged.dispose();
  parts.forEach((g) => g.dispose());
  return { positions, normals, tones, height: maxY - minY || 1, radius: radius || 1 };
}

function disposeModel(model: Object3D) {
  model.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) => m.dispose());
  });
}

/**
 * Renders the title with the site's display + script fonts and samples it
 * on a staggered grid (about targetPoints dots). Returns normalised positions (x in -1..1), a size per
 * dot from ink coverage, and which dots belong to the script word.
 */
export async function sampleTitle(lines: string[], scriptWord: string | undefined, targetPoints: number) {
  const root = getComputedStyle(document.documentElement);
  const display = root.getPropertyValue('--ff-display').trim() || 'sans-serif';
  const scriptFont = root.getPropertyValue('--ff-script').trim() || 'cursive';
  try {
    await Promise.all([document.fonts.load(`400 200px ${display}`), document.fonts.load(`400 120px ${scriptFont}`)]);
  } catch {}

  const W = 2000;
  const fs = 330;
  const lh = fs * 0.86;
  const H = Math.round(lines.length * lh + fs * 0.35);
  const make = () => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    return c.getContext('2d', { willReadFrequently: true })!;
  };
  const textCtx = make();
  textCtx.font = `400 ${fs}px ${display}`;
  textCtx.textBaseline = 'alphabetic';
  textCtx.textAlign = 'center';
  const upper = lines.map((l) => l.toUpperCase());
  // Shrink if the longest line would overflow.
  const widest = Math.max(...upper.map((l) => textCtx.measureText(l).width));
  const scale = Math.min(1, (W * 0.96) / widest);
  textCtx.font = `400 ${fs * scale}px ${display}`;
  upper.forEach((line, i) => textCtx.fillText(line, W / 2, fs * 0.2 + (i + 1) * lh * scale));

  const scriptCtx = make();
  if (scriptWord && upper.length > 1) {
    const line2Width = textCtx.measureText(upper[1]).width;
    const x = W / 2 - line2Width / 2 - fs * 0.05;
    // Just under line 1's baseline, overlapping both lines like DisplayTitle.
    const y = fs * 0.2 + lh * scale + fs * scale * 0.2;
    scriptCtx.font = `400 ${fs * scale * 0.7}px ${scriptFont}`;
    scriptCtx.translate(x, y);
    scriptCtx.rotate((-14 * Math.PI) / 180);
    // Thicken the thin script strokes so they survive being sampled as dots.
    scriptCtx.lineWidth = fs * scale * 0.03;
    scriptCtx.lineJoin = 'round';
    scriptCtx.strokeText(scriptWord, 0, 0);
    scriptCtx.fillText(scriptWord, 0, 0);
  }

  const text = textCtx.getImageData(0, 0, W, H).data;
  const scr = scriptCtx.getImageData(0, 0, W, H).data;

  // Pick a grid step that gives roughly TARGET_POINTS dots.
  let filled = 0;
  for (let i = 3; i < text.length; i += 4 * 9) if (text[i] > 128 || scr[i] > 128) filled++;
  const area = filled * 9;
  const step = Math.max(5, Math.sqrt(area / targetPoints));

  const pts: number[] = [];
  const sizes: number[] = [];
  const isScript: number[] = [];
  // Staggered (hex) grid over one canvas; size is relative to the title step.
  const sampleGrid = (data: Uint8ClampedArray, gridStep: number, script: boolean) => {
    let row = 0;
    for (let y = gridStep / 2; y < H; y += gridStep * 0.866, row++) {
      for (let x = (row % 2 ? gridStep / 2 : 0) + gridStep / 2; x < W; x += gridStep) {
        const a = data[(Math.floor(y) * W + Math.floor(x)) * 4 + 3] / 255;
        if (a < 0.15) continue;
        pts.push((x - W / 2) / (W / 2), -(y - H / 2) / (W / 2));
        sizes.push(Math.sqrt(a) * (gridStep / step));
        isScript.push(script ? 1 : 0);
      }
    }
  };
  sampleGrid(text, step, false);
  // The script is thin: sample it about twice as finely so it stays legible.
  sampleGrid(scr, Math.max(2.5, step * 0.45), true);
  return {
    points: new Float32Array(pts),
    sizes: new Float32Array(sizes),
    script: new Float32Array(isScript),
    count: sizes.length,
    aspect: H / W,
    /** Grid step in normalised units (x range is 2). */
    step: (step / W) * 2,
  };
}

