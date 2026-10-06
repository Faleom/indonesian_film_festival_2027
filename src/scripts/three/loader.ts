/**
 * Lazy loader for the halftone 3D blocks, the vanilla equivalent of
 * client:visible. Blocks opt in with data-halftone-3d="<kind>":
 *   camera     <HalftoneCamera />      rotating halftone camera
 *   hero       <HomeHero />            camera dots -> festival title (pinned)
 *   filmstrip  <FilmStripJourney />    3D b-roll film strip (pinned)
 *   event      <EventHero3D />         scroll-driven event page hero (pinned);
 *                                      data-scene picks the builder in ./events
 *
 * - Three.js is only downloaded when a block is near the viewport
 * - only with motion on and WebGL available; phones and tablets get lighter
 *   versions ("lite": fewer particles, lower resolution). Reduced motion and
 *   no-JS keep the static fallback layout
 * - blocks with data-live-layout get .is-3d straight away (pinned layout),
 *   and .is-live once the first frame has rendered
 * - renders only while on screen; disposed (WebGL released) on page leave
 *
 * Budget: max one heavy 3D scene per page, two on home (see CLAUDE.md).
 */
import type { SceneHandle } from './scene';

interface Instance {
  handle?: SceneHandle;
  visible?: boolean;
  observers: IntersectionObserver[];
  disposed: boolean;
}

const instances = new Map<HTMLElement, Instance>();
let themeObserver: MutationObserver | undefined;
const exportMode = new URLSearchParams(location.search).has('export-3d');
/** Phones/tablets: lighter scenes. */
const lite = () => !matchMedia('(min-width: 1024px) and (pointer: fine)').matches;
/**
 * Low-end phones/tablets (≤4 cores or ≤4 GB RAM, e.g. budget Android) start
 * at 1x resolution instead of stepping down after a laggy first few seconds.
 * Everything else starts at full quality; frameLoop lowers it only if needed.
 */
const maxDpr = () => {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const lowEnd = (nav.hardwareConcurrency || 8) <= 4 || (nav.deviceMemory || 8) <= 4;
  return lite() && lowEnd ? 1 : undefined;
};

const mounters: Record<string, (el: HTMLElement) => Promise<SceneHandle>> = {
  camera: async (el) =>
    (await import('./scene')).mountScene(el, {
      modelUrl: el.dataset.model || undefined,
      dotSize: Number(el.dataset.dotSize) || undefined,
      exportMode,
    }),
  hero: async (el) => {
    const opts = {
      modelUrl: el.dataset.model || undefined,
      lines: JSON.parse(el.dataset.title || '[]'),
      script: el.dataset.script || undefined,
      lite: lite(),
      maxDpr: maxDpr(),
      bgVideo: el.dataset.bgVideo || undefined,
    };
    // EXPERIMENT: ?hero=classic|solid overrides data-variant on <HomeHero />.
    const variant = new URLSearchParams(location.search).get('hero') || el.dataset.variant;
    return variant === 'solid'
      ? (await import('./heroSceneSolid')).mountHeroSolid(el, opts)
      : (await import('./heroScene')).mountHero(el, opts);
  },
  event: async (el) => {
    const [{ mountEventScene }, { eventScenes }] = await Promise.all([import('./eventScene'), import('./events')]);
    const load = eventScenes[el.dataset.scene ?? ''];
    if (!load) throw new Error(`Unknown event scene "${el.dataset.scene}"`);
    return mountEventScene(el, await load(), { lite: lite(), maxDpr: maxDpr() });
  },
  filmstrip: async (el) =>
    (await import('./filmStrip')).mountFilmStrip(el, JSON.parse(el.dataset.strip || '{}'), {
      lite: lite(),
      maxDpr: maxDpr(),
      // EXPERIMENT: ?strip=classic|solid overrides data-variant on <FilmStripJourney />.
      look: new URLSearchParams(location.search).get('strip') || el.dataset.variant,
    }),
};

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

function canRunLive(): boolean {
  if (exportMode) return true;
  return document.documentElement.dataset.motion === 'on' && webglAvailable();
}

async function mount(el: HTMLElement, inst: Instance) {
  // Not el.dataset: 'data-halftone-3d' maps to dataset['halftone-3d'] (digits aren't camel-cased).
  const kind = el.getAttribute('data-halftone-3d') || 'camera';
  const mountFn = mounters[kind];
  if (!mountFn) return console.warn(`[halftone-3d] Unknown kind "${kind}"`);
  try {
    inst.handle = await mountFn(el);
  } catch (err) {
    // Never leave a broken pinned layout behind: fall back to the static version.
    console.warn('[halftone-3d] Falling back to static layout.', err);
    el.classList.remove('is-3d');
    return;
  }
  if (inst.disposed) return inst.handle.dispose();
  el.classList.add('is-live');

  // Animate only while visible, and not while the loading screen covers the
  // page (its first frame is already drawn for when the loader opens up).
  const visible = new IntersectionObserver(([entry]) => {
    inst.visible = entry.isIntersecting;
    applyActive(inst);
  });
  visible.observe(el);
  inst.observers.push(visible);

  if (exportMode && kind === 'camera') {
    (window as any).__ht3dExport = () => el.querySelector('canvas')!.toDataURL('image/png');
  }
}

const covered = () => document.documentElement.dataset.loading === 'on';
const applyActive = (inst: Instance) => inst.handle?.setActive(!!inst.visible && !covered());
// The loading screen starts to open (data-loading on -> out / removed): start rendering.
let loadingObserver: MutationObserver | undefined;

/** Tells the loading screen (Loader.astro) that every 3D block has built (or failed). */
function settle() {
  (window as any).__ht3dSettled = true;
  document.dispatchEvent(new Event('ht3d:settled'));
}

function init() {
  const blocks = document.querySelectorAll<HTMLElement>('[data-halftone-3d]');
  if (!blocks.length || !canRunLive()) return settle();
  // Loading screen up: build everything now, behind it, instead of on approach.
  const loading = document.documentElement.dataset.loading === 'on';
  const builds: Promise<void>[] = [];

  blocks.forEach((el) => {
    const inst: Instance = { observers: [], disposed: false };
    instances.set(el, inst);
    if (el.hasAttribute('data-live-layout')) el.classList.add('is-3d');
    let started: Promise<void> | undefined;
    const start = () => {
      if (started || inst.disposed) return started;
      near.disconnect();
      return (started = mount(el, inst));
    };
    const near = new IntersectionObserver(([entry]) => entry.isIntersecting && start(), { rootMargin: '400px' });
    near.observe(el);
    inst.observers.push(near);
    if (loading) {
      builds.push(start() ?? Promise.resolve());
      return;
    }
    // data-preload="idle": set up while the browser is idle after load, so the
    // build never lands mid-scroll (a fast swipe used to hit it and stutter).
    if (el.dataset.preload === 'idle') {
      const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
      const later = () => (idle ? idle(start, { timeout: 2500 }) : setTimeout(start, 1200));
      if (document.readyState === 'complete') later();
      else addEventListener('load', later, { once: true });
    }
  });

  Promise.allSettled(builds).then(settle);
  if (loading) {
    loadingObserver = new MutationObserver(() => {
      if (covered()) return;
      loadingObserver?.disconnect();
      instances.forEach(applyActive);
    });
    loadingObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-loading'] });
  }

  // Theme switches (styleguide buttons) refresh ink colours. Not the film
  // strip re-inking its own stage: that used to make the off-screen hero
  // redraw on every event change while scrolling the strip.
  themeObserver = new MutationObserver((records) => {
    if (records.every((r) => (r.target as Element).closest('.strip3d__stage, .cursor'))) return;
    instances.forEach((i) => i.handle?.refreshColours());
  });
  themeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-theme'], subtree: true });

  // Styleguide controls: dot size slider.
  document.querySelectorAll<HTMLInputElement>('[data-ht3d-dot]').forEach((input) => {
    input.disabled = false;
    input.oninput = () => {
      const target = document.getElementById(input.dataset.ht3dDot!);
      if (target) instances.get(target)?.handle?.setDotSize?.(Number(input.value));
    };
  });
}

function disposeAll() {
  instances.forEach((inst) => {
    inst.disposed = true;
    inst.observers.forEach((o) => o.disconnect());
    inst.handle?.dispose();
  });
  instances.clear();
  themeObserver?.disconnect();
  loadingObserver?.disconnect();
}

document.addEventListener('astro:page-load', init);
document.addEventListener('astro:before-swap', disposeAll);
