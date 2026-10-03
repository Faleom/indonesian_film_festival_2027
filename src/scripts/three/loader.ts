/**
 * Lazy loader for the halftone 3D blocks, the vanilla equivalent of
 * client:visible. Blocks opt in with data-halftone-3d="<kind>":
 *   camera     <HalftoneCamera />      rotating halftone camera
 *   hero       <HomeHero />            camera dots -> festival title (pinned)
 *   filmstrip  <FilmStripJourney />    3D b-roll film strip (pinned)
 *
 * - Three.js is only downloaded when a block is near the viewport
 * - only with motion on and WebGL available; phones and tablets get lighter
 *   versions ("lite": fewer particles, lower resolution). Reduced motion and
 *   no-JS keep the static fallback layout
 * - blocks with data-live-layout get .is-3d straight away (pinned layout),
 *   and .is-live once the first frame has rendered
 * - renders only while on screen; disposed (WebGL released) on page leave
 *
 * Budget: heavy 3D is allowed in max 3 spots site-wide (see CLAUDE.md).
 */
import type { SceneHandle } from './scene';

interface Instance {
  handle?: SceneHandle;
  observers: IntersectionObserver[];
  disposed: boolean;
}

const instances = new Map<HTMLElement, Instance>();
let themeObserver: MutationObserver | undefined;
const exportMode = new URLSearchParams(location.search).has('export-3d');
/** Phones/tablets: lighter scenes. */
const lite = () => !matchMedia('(min-width: 1024px) and (pointer: fine)').matches;

const mounters: Record<string, (el: HTMLElement) => Promise<SceneHandle>> = {
  camera: async (el) =>
    (await import('./scene')).mountScene(el, {
      modelUrl: el.dataset.model || undefined,
      dotSize: Number(el.dataset.dotSize) || undefined,
      exportMode,
    }),
  hero: async (el) =>
    (await import('./heroScene')).mountHero(el, {
      modelUrl: el.dataset.model || undefined,
      lines: JSON.parse(el.dataset.title || '[]'),
      script: el.dataset.script || undefined,
      lite: lite(),
    }),
  filmstrip: async (el) => (await import('./filmStrip')).mountFilmStrip(el, JSON.parse(el.dataset.strip || '{}'), { lite: lite() }),
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

  // Animate only while visible.
  const visible = new IntersectionObserver(([entry]) => inst.handle?.setActive(entry.isIntersecting));
  visible.observe(el);
  inst.observers.push(visible);

  if (exportMode && kind === 'camera') {
    (window as any).__ht3dExport = () => el.querySelector('canvas')!.toDataURL('image/png');
  }
}

function init() {
  const blocks = document.querySelectorAll<HTMLElement>('[data-halftone-3d]');
  if (!blocks.length || !canRunLive()) return;

  blocks.forEach((el) => {
    const inst: Instance = { observers: [], disposed: false };
    instances.set(el, inst);
    if (el.hasAttribute('data-live-layout')) el.classList.add('is-3d');
    const near = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        near.disconnect();
        mount(el, inst);
      },
      { rootMargin: '400px' },
    );
    near.observe(el);
    inst.observers.push(near);
  });

  // Theme switches (styleguide buttons, film strip re-inking) refresh ink colours.
  themeObserver = new MutationObserver(() => instances.forEach((i) => i.handle?.refreshColours()));
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
}

document.addEventListener('astro:page-load', init);
document.addEventListener('astro:before-swap', disposeAll);
