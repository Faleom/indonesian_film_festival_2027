/**
 * Lazy loader for halftone 3D blocks (<HalftoneCamera />), the vanilla
 * equivalent of client:visible:
 *   - Three.js is only downloaded when a block is near the viewport
 *   - only on desktop-class devices (fine pointer, >= 768px) with motion on;
 *     everyone else keeps the static halftone fallback image
 *   - renders only while on screen; disposed (WebGL context released) on page leave
 *
 * Budget: heavy 3D is allowed in max 3 hero spots site-wide (see CLAUDE.md).
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
  return (
    document.documentElement.dataset.motion === 'on' &&
    matchMedia('(min-width: 768px) and (pointer: fine)').matches &&
    webglAvailable()
  );
}

async function mount(el: HTMLElement, inst: Instance) {
  const { mountScene } = await import('./scene');
  if (inst.disposed) return;
  inst.handle = await mountScene(el, {
    modelUrl: el.dataset.model || undefined,
    dotSize: Number(el.dataset.dotSize) || undefined,
    exportMode,
  });
  if (inst.disposed) return inst.handle.dispose();
  el.classList.add('is-live');

  // Animate only while visible.
  const visible = new IntersectionObserver(([entry]) => inst.handle?.setActive(entry.isIntersecting));
  visible.observe(el);
  inst.observers.push(visible);

  if (exportMode) (window as any).__ht3dExport = () => el.querySelector('canvas')!.toDataURL('image/png');
}

function init() {
  const blocks = document.querySelectorAll<HTMLElement>('[data-halftone-3d]');
  if (!blocks.length || !canRunLive()) return;

  blocks.forEach((el) => {
    const inst: Instance = { observers: [], disposed: false };
    instances.set(el, inst);
    const near = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        near.disconnect();
        mount(el, inst);
      },
      { rootMargin: '300px' },
    );
    near.observe(el);
    inst.observers.push(near);
  });

  // Theme switches (e.g. styleguide buttons) re-read the ink colours.
  themeObserver = new MutationObserver(() => instances.forEach((i) => i.handle?.refreshColours()));
  themeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-theme'], subtree: true });

  // Styleguide controls: dot size slider.
  document.querySelectorAll<HTMLInputElement>('[data-ht3d-dot]').forEach((input) => {
    input.disabled = false;
    input.oninput = () => {
      const target = document.getElementById(input.dataset.ht3dDot!);
      if (target) instances.get(target)?.handle?.setDotSize(Number(input.value));
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
