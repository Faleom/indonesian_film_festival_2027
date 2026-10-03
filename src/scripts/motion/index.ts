/**
 * Motion entry point. Always loaded (tiny). Handles the kill switch, the
 * footer toggle and page swaps, and only imports the GSAP/Lenis engine when
 * motion is on, so reduced-motion visitors never download it.
 *
 * Kill switch: <html data-motion="on|off">, set before paint by MotionHead.astro.
 */
type Engine = typeof import('./engine');

const root = document.documentElement;
const motionOn = () => root.dataset.motion === 'on';
let engine: Engine | undefined;
let navigated = false;

async function loadEngine(): Promise<Engine> {
  engine ??= await import('./engine');
  return engine;
}

function setupToggle() {
  const btn = document.getElementById('motion-toggle');
  if (!(btn instanceof HTMLButtonElement)) return;
  btn.hidden = false;
  btn.setAttribute('aria-pressed', String(motionOn()));
  btn.querySelector('[data-motion-state]')!.textContent = motionOn() ? 'On' : 'Off';
  btn.onclick = () => {
    try {
      localStorage.setItem('iff-motion', motionOn() ? 'off' : 'on');
    } catch {}
    location.reload();
  };
}

function setupReplayButtons() {
  document.querySelectorAll<HTMLButtonElement>('[data-reveal-replay]').forEach((btn) => {
    btn.hidden = !motionOn();
    btn.onclick = async () => {
      const target = document.getElementById(btn.dataset.revealReplay!);
      if (target) (await loadEngine()).replay(target);
    };
  });
}

document.addEventListener('astro:page-load', async () => {
  setupToggle();
  setupReplayButtons();
  if (!motionOn()) return;
  const e = await loadEngine();
  (window as any).__iffMotion = true;
  e.start({ navigated });
});

document.addEventListener('astro:before-swap', (event) => {
  const next = event.newDocument.documentElement;
  // The router copies <html> attributes from the new page; carry motion state over.
  next.dataset.motion = root.dataset.motion;
  next.classList.toggle('motion-js', root.classList.contains('motion-js'));

  navigated = true;
  if (!motionOn()) return;
  engine?.stop();

  // Riso plate: the next page's colour prints over the old one (see motion.css).
  if ('startViewTransition' in document) {
    next.dataset.printing = '';
    event.viewTransition.finished.finally(() => delete root.dataset.printing);
  }
});
