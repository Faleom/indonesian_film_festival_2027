/**
 * Scroll-driven 3D heroes for the event pages (components/pages/EventHero3D.astro).
 *
 * One shared engine, one scene builder per event (./events/*). The builder
 * makes a lit scene from primitives; the engine prints it through the same
 * halftone pass as the home hero (theme primary + dark key plate, grain), pins
 * it for a long scroll and feeds the builder the scroll progress p (0..1).
 *
 * Follows the hard-won rules: scene rendered at dot resolution, 60 fps cap,
 * time-based easing, renders only while visible (loader.ts), positions cached
 * (no layout reads per frame), lighter on phones, disposed on page leave.
 */
import { AmbientLight, DirectionalLight, PerspectiveCamera, Scene, type Object3D } from 'three';
import { clamp01, createHalftonePass, createRenderer, cssVar, disposeObject, ease, frameLoop, releaseRenderer, setInk } from './post';
import type { SceneHandle } from './scene';


export interface BuildContext {
  scene: Scene;
  camera: PerspectiveCamera;
  lite: boolean;
  /** Portrait viewport (phones): builders frame their shots tighter. */
  portrait: () => boolean;
}

export interface FrameState {
  /** Smoothed scroll progress through the pinned section, 0..1. */
  p: number;
  /** Seconds since mount. */
  t: number;
  dt: number;
  /** Smoothed pointer, -1..1. */
  mx: number;
  my: number;
  /** Halftone pass controls the scene may change this frame. */
  print: { dotScale: number; tone: number };
}

export interface EventBuild {
  /** Called every frame: pose the camera and objects for this progress. */
  update(state: FrameState): void;
  /** Extra cleanup beyond disposing the scene graph. */
  dispose?(): void;
  /** Halftone screen size in CSS px (default 5). */
  dotSize?: number;
  /** Key plate strength (default 0.8). */
  keyStrength?: number;
}

export type EventBuilder = (ctx: BuildContext) => EventBuild | Promise<EventBuild>;

export interface EventSceneOptions {
  lite: boolean;
  maxDpr?: number;
}

export async function mountEventScene(host: HTMLElement, builder: EventBuilder, opts: EventSceneOptions): Promise<SceneHandle> {
  const stage = (host.querySelector('[data-ev3d-stage]') as HTMLElement) ?? host;
  const scene = new Scene();
  const camera = new PerspectiveCamera(40, 1, 0.1, 200);
  scene.add(new AmbientLight(0xffffff, 0.45));
  const key = new DirectionalLight(0xffffff, 2.3);
  key.position.set(5, 8, 6);
  const rim = new DirectionalLight(0xffffff, 0.6);
  rim.position.set(-6, 3, -5);
  scene.add(key, rim);

  let portrait = false;
  const build = await builder({ scene, camera, lite: opts.lite, portrait: () => portrait });
  const baseDot = build.dotSize ?? 5;

  const { renderer, canvas, dpr: startDpr } = createRenderer(stage, { maxDpr: opts.maxDpr ?? (opts.lite ? 1.5 : 2) });
  let dpr = startDpr;
  const pass = createHalftonePass(renderer, dpr, { dotSize: baseDot, keyStrength: build.keyStrength ?? 0.8, grain: 0.5 });

  const refreshColours = () => {
    setInk(pass.uniforms.uInk.value, cssVar(host, '--c-primary'));
    setInk(pass.uniforms.uKey.value, cssVar(host, '--c-dark'));
  };
  refreshColours();

  // Cached geometry: section top (page coords) and pinned span.
  let top = 0;
  let span = 1;
  const measure = () => {
    const r = host.getBoundingClientRect();
    top = r.top + scrollY;
    span = Math.max(1, r.height - stage.offsetHeight);
  };
  const resize = () => {
    const { width, height } = stage.getBoundingClientRect();
    if (!width || !height) return;
    portrait = width / height < 1;
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    pass.setSize(width, height, dpr);
    pass.uniforms.uMisregister.value.set(3 * dpr, -2 * dpr);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    measure();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(stage);
  ro.observe(host);
  resize();

  const progress = () => clamp01((scrollY - top) / span);
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  const onPointer = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    pointer.x = (e.clientX / innerWidth) * 2 - 1;
    pointer.y = (e.clientY / innerHeight) * 2 - 1;
  };
  addEventListener('pointermove', onPointer, { passive: true });

  // DOM overlay beats read --p (written only when it changes).
  let cssP = '';
  let scrolled = false;
  const start = performance.now();
  let smoothP = progress();
  const state: FrameState = { p: 0, t: 0, dt: 16, mx: 0, my: 0, print: { dotScale: 1, tone: 1 } };

  const render = (dt = 1000 / 60) => {
    smoothP += (progress() - smoothP) * ease(0.1, dt);
    pointer.sx += (pointer.x - pointer.sx) * ease(0.05, dt);
    pointer.sy += (pointer.y - pointer.sy) * ease(0.05, dt);
    state.p = smoothP;
    state.t = (performance.now() - start) / 1000;
    state.dt = dt;
    state.mx = pointer.sx;
    state.my = pointer.sy;
    state.print.dotScale = 1;
    state.print.tone = 1;
    build.update(state);

    const next = smoothP.toFixed(3);
    if (next !== cssP) host.style.setProperty('--p', (cssP = next));
    // The scroll cue is invisible past the intro: stop its CSS loop.
    if (smoothP > 0.17 !== scrolled) host.classList.toggle('is-scrolled', (scrolled = smoothP > 0.17));
    pass.uniforms.uDotSize.value = baseDot * dpr * state.print.dotScale;
    pass.uniforms.uTone.value = state.print.tone;
    pass.uniforms.uTime.value = Math.floor(state.t * 4) / 12;
    pass.render(scene, camera);
  };

  const loop = frameLoop(render, {
    onSlow() {
      if (dpr <= 1) return;
      dpr = Math.max(1, dpr - 0.5);
      resize();
    },
  });
  renderer.compile(scene, camera);
  render();

  let active = false;
  return {
    setActive(next) {
      if (next === active) return;
      active = next;
      if (active) {
        measure();
        loop.start();
      } else loop.stop();
      // A jump past the hero (anchor link, fast fling) renders no frame in between: settle the flag here.
      if (progress() > 0.17 !== scrolled) host.classList.toggle('is-scrolled', (scrolled = progress() > 0.17));
    },
    refreshColours() {
      refreshColours();
      if (!active) render();
    },
    dispose() {
      active = false;
      loop.stop();
      removeEventListener('pointermove', onPointer);
      ro.disconnect();
      build.dispose?.();
      disposeObject(scene as Object3D);
      pass.dispose();
      releaseRenderer(renderer, canvas);
    },
  };
}
