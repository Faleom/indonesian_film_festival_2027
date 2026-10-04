/**
 * EXPERIMENT: "solid" variant of the home hero (classic = heroScene.ts).
 *
 * The camera starts as a real lit 3D object printed through the halftone
 * post-pass (fine screen, two-plate riso, calm grain), so it reads as a solid
 * thing instead of a swarm of dots. When the explode starts, its print fades
 * out (dots shrink away) while the particle version appears on the same
 * surface, then flies apart and assembles into the title like the classic one.
 *
 * Scroll map (p = progress through the pinned section, 0..1):
 *   0.00-0.30  solid camera turns
 *   0.18-0.34  solid print dissolves into particles
 *   0.24-0.55  explode into a spinning cloud
 *   0.50-0.85  assemble into the title
 *   0.85-1.00  hold
 *
 * Switch variants with ?hero=classic / ?hero=solid (see loader.ts).
 */
import {
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  Euler,
  Float32BufferAttribute,
  Group,
  Matrix4,
  Matrix3,
  NormalBlending,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
} from 'three';
import { createBackdrop } from './heroBackdrop';
import { particleFragment, particleVertex } from './particleShader';
import { createHalftonePass, createRenderer, cssVar, disposeObject, frameLoop, releaseRenderer, setInk } from './post';
import { loadModel, type SceneHandle } from './scene';
import {
  addScriptShadow,
  CAMERA_DISTANCE,
  FOV,
  LITE_POINTS,
  TARGET_POINTS,
  clamp01,
  sampleModel,
  sampleTitle,
  smooth,
  type HeroOptions,
} from './heroScene';

/** Knobs to play with. */
const SOLID = {
  /** Halftone screen on the solid camera, CSS px. Smaller = smoother, more "photo". */
  dotSize: 4.5,
  /** Shadow plate (theme dark, misregistered). 0 = single colour. */
  keyStrength: 0.8,
  /** Ink speckle amount, 0..1. */
  grain: 0.45,
  /** How often grain re-rolls per second (classic: 12). Lower = calmer. */
  grainFps: 3,
  /** Scatter cloud wobble (classic: 0.12). */
  breath: 0.04,
  /** Idle left/right sway of the camera, radians (classic: 0.06). */
  idleSway: 0.025,
  /** Scroll window where the solid print hands over to particles. */
  dissolve: [0.18, 0.34] as [number, number],
};

export async function mountHeroSolid(host: HTMLElement, opts: HeroOptions): Promise<SceneHandle> {
  const stage = (host.querySelector('[data-hero-stage]') as HTMLElement) ?? host;
  const target = opts.lite ? LITE_POINTS : TARGET_POINTS;
  const [model, title] = await Promise.all([loadModel(opts.modelUrl), sampleTitle(opts.lines, opts.script, target)]);

  const count = Math.max(target, title.count);
  const cam = sampleModel(model, count);

  // ---- Particles (same setup as classic) ----
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
    scatter.set([s * Math.cos(th) * r * 1.5, u * r * 0.65 + 0.6, s * Math.sin(th) * r * 1.6 - 1], i * 3);
    rand[i] = Math.random();
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

  const { renderer, canvas, dpr: startDpr } = createRenderer(stage, { maxDpr: opts.maxDpr ?? (opts.lite ? 1.5 : 2) });
  // Lowered (never raised) by frameLoop's onSlow if the device can't keep up.
  let dpr = startDpr;
  // Both passes clear explicitly; the particles draw on top of the solid print.
  renderer.autoClear = false;

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
    uBreath: { value: SOLID.breath },
    uGrainFps: { value: SOLID.grainFps },
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

  const particleScene = new Scene();
  const particleGroup = new Group();
  const colourPoints = new Points(geometry, colourMat);
  const keyPoints = new Points(geometry, keyMat);
  keyPoints.renderOrder = 1;
  colourPoints.frustumCulled = keyPoints.frustumCulled = false;
  particleGroup.add(colourPoints, keyPoints);
  const shadowMat = addScriptShadow(geometry, colourMat, uniforms, particleGroup);
  particleScene.add(particleGroup);

  // ---- Solid camera, lit, printed by the halftone pass ----
  const solidScene = new Scene();
  solidScene.add(new AmbientLight(0xffffff, 0.5));
  const keyLight = new DirectionalLight(0xffffff, 2.4);
  keyLight.position.set(4, 6, 5);
  const rimLight = new DirectionalLight(0xffffff, 0.7);
  rimLight.position.set(-5, 2, -4);
  solidScene.add(keyLight, rimLight);
  const solidGroup = new Group(); // mirrors particleGroup (pointer tilt)
  const pivot = new Group(); // mirrors uRot + uCamScale
  pivot.add(model);
  solidGroup.add(pivot);
  solidScene.add(solidGroup);

  const pass = createHalftonePass(renderer, dpr, { dotSize: SOLID.dotSize, keyStrength: SOLID.keyStrength, grain: SOLID.grain });
  const backdrop = createBackdrop(opts.bgVideo, dpr, !!opts.lite);

  const camera = new PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.set(0, 0, CAMERA_DISTANCE);

  const refreshColours = () => {
    setInk(uniforms.uInk.value, cssVar(host, '--c-primary'));
    setInk(uniforms.uKey.value, cssVar(host, '--c-dark'));
    setInk(uniforms.uScriptInk.value, cssVar(host, '--c-beige'));
    uniforms.uScriptInk.value.multiplyScalar(0.8);
    pass.uniforms.uInk.value.copy(uniforms.uInk.value);
    pass.uniforms.uKey.value.copy(uniforms.uKey.value);
    backdrop.ink.copy(uniforms.uInk.value);
  };
  refreshColours();

  const resize = () => {
    const { width, height } = stage.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    pass.setSize(width, height, dpr);
    pass.uniforms.uMisregister.value.set(3 * dpr, -2 * dpr);
    uniforms.uMisregister.value.set(3 * dpr, -2.5 * dpr);
    backdrop.setSize(width, height, dpr);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    uniforms.uResolution.value.set(width * dpr, height * dpr);
    const halfH = CAMERA_DISTANCE * Math.tan((FOV * Math.PI) / 360);
    const halfW = halfH * camera.aspect;
    const pxPerWorld = (height * dpr) / 2 / halfH;
    const titleHalf = Math.min(halfW * 0.84, (halfH * 0.6) / title.aspect);
    uniforms.uTitleHalf.value = titleHalf;
    uniforms.uTitleOffset.value.set(0, halfH * 0.14);
    uniforms.uTitleDotPx.value = title.step * titleHalf * pxPerWorld * 1.12;
    // Fit the camera into the free band between the kicker and the intro text
    // (on phones the intro takes the lower half), and centre it there.
    const cssPerWorld = height / 2 / halfH;
    const stageTop = stage.getBoundingClientRect().top;
    const kicker = host.querySelector('.hero3d__overlay .kicker')?.getBoundingClientRect();
    const bottom = host.querySelector('.hero3d__bottom')?.getBoundingClientRect();
    const freeTop = kicker ? kicker.bottom - stageTop + 16 : 0;
    const freeBottom = bottom ? bottom.top - stageTop - 16 : height;
    const freeHalf = Math.max(80, freeBottom - freeTop) / 2 / cssPerWorld;
    uniforms.uCamScale.value = Math.min((freeHalf * 1.8) / cam.height, (halfH * 1.55) / cam.height, (halfW * 0.82) / cam.radius);
    uniforms.uCamOffset.value.set(0, (height / 2 - (freeTop + freeBottom) / 2) / cssPerWorld, 0);
    pivot.scale.setScalar(uniforms.uCamScale.value);
    pivot.position.copy(uniforms.uCamOffset.value);
    backdrop.setTextBand((height - freeBottom) / height);

    // Portrait (phones): the title is width-bound, so let it run almost edge to
    // edge and centre it in the free band with the camera. Landscape keeps the
    // layout above.
    if (camera.aspect < 1) {
      const portraitHalf = Math.min(halfW * 0.98, (freeHalf * 0.9) / title.aspect);
      uniforms.uTitleHalf.value = portraitHalf;
      uniforms.uTitleDotPx.value = title.step * portraitHalf * pxPerWorld * 1.12;
      uniforms.uTitleOffset.value.set(0, uniforms.uCamOffset.value.y);
    }
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

  const progress = () => {
    const r = host.getBoundingClientRect();
    const span = r.height - innerHeight;
    return span > 0 ? clamp01(-r.top / span) : 0;
  };

  const euler = new Euler();
  const m4 = new Matrix4();
  let smoothP = progress();
  let active = false;
  const start = performance.now();
  let colourUntil = 0;

  // CSS hooks for the print decoration. Written only when they change, and
  // the pointer ones only on the decoration (not the whole hero subtree).
  const decor = host.querySelector<HTMLElement>('.hero3d__decor');
  const css = { p: '', mx: '', my: '' };
  const writeCss = (p: number) => {
    const next = { p: p.toFixed(3), mx: pointer.sx.toFixed(3), my: pointer.sy.toFixed(3) };
    if (next.p !== css.p) host.style.setProperty('--hero-p', (css.p = next.p));
    if (decor && next.mx !== css.mx) decor.style.setProperty('--mx', (css.mx = next.mx));
    if (decor && next.my !== css.my) decor.style.setProperty('--my', (css.my = next.my));
  };

  const render = () => {
    const t = (performance.now() - start) / 1000;
    if (performance.now() < colourUntil) refreshColours();
    smoothP += (progress() - smoothP) * 0.12;
    const p = smoothP;
    pointer.sx += (pointer.x - pointer.sx) * 0.06;
    pointer.sy += (pointer.y - pointer.sy) * 0.06;

    const turn = smooth(0, 0.3, p);
    euler.set(0.28 + pointer.sy * 0.2, -1.05 + turn * 1.9 + pointer.sx * 0.35 + Math.sin(t * 0.5) * SOLID.idleSway, 0);
    uniforms.uRot.value.setFromMatrix4(m4.makeRotationFromEuler(euler));
    pivot.rotation.copy(euler);
    particleGroup.rotation.set(pointer.sy * 0.05, pointer.sx * 0.1, 0);
    solidGroup.rotation.copy(particleGroup.rotation);

    const dissolve = smooth(SOLID.dissolve[0], SOLID.dissolve[1], p);
    const appear = smooth(SOLID.dissolve[0], SOLID.dissolve[0] + (SOLID.dissolve[1] - SOLID.dissolve[0]) * 0.6, p);

    uniforms.uExplode.value = smooth(0.24, 0.55, p);
    uniforms.uAssemble.value = smooth(0.5, 0.85, p);
    uniforms.uSpin.value = p * 3.2 + t * 0.05;
    uniforms.uDotPx.value = (6 + turn * 3) * dpr * appear;
    uniforms.uTime.value = t;
    writeCss(p);

    // Solid print: dots shrink away and coarsen a little as it dissolves.
    // Grain is stepped to grainFps (the shader re-rolls on floor(uTime * 12)).
    pass.uniforms.uTone.value = 1 - dissolve;
    pass.uniforms.uDotSize.value = SOLID.dotSize * dpr * (1 + dissolve * 0.8);
    pass.uniforms.uTime.value = Math.floor(t * SOLID.grainFps) / 12;

    renderer.setRenderTarget(null);
    renderer.clear();
    // Video backdrop first; it eases back while the title assembles.
    backdrop.render(renderer, t, 1 - smooth(0.5, 0.85, p) * 0.6);
    if (dissolve < 1) pass.render(solidScene, camera, false);
    if (appear > 0) {
      renderer.clearDepth();
      renderer.render(particleScene, camera);
    }
  };

  const loop = frameLoop(render, {
    onSlow() {
      if (dpr <= 1) return;
      dpr = Math.max(1, dpr - 0.5);
      resize();
    },
  });
  render();

  return {
    setActive(next) {
      if (next === active) return;
      active = next;
      backdrop.setPlaying(active);
      if (active) {
        refreshColours();
        colourUntil = performance.now() + 900;
        loop.start();
      } else loop.stop();
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
      disposeObject(solidScene);
      pass.dispose();
      backdrop.dispose();
      releaseRenderer(renderer, canvas);
    },
  };
}
