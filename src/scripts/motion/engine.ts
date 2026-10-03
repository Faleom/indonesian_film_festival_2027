/**
 * GSAP + ScrollTrigger + Lenis, loaded only when motion is on.
 * start() runs on every page load, stop() before every page swap.
 */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { buildReveal, type RevealHandle } from './reveals';
import { startCursor, type CursorHandle } from './cursor';
import { clippingTilt, foldingAccordions, marquees, reprint, scrollDots, teamStacks } from './effects';

gsap.registerPlugin(ScrollTrigger, SplitText);

let lenis: Lenis | undefined;
let cursor: CursorHandle | undefined;
const reveals = new Map<HTMLElement, RevealHandle>();
let cleanups: (() => void)[] = [];
const raf = (time: number) => lenis?.raf(time * 1000);
let refreshTimer: number | undefined;

/** Accordions and other height changes move trigger positions. */
const onToggle = () => {
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(() => ScrollTrigger.refresh(), 50);
};

/** @param navigated true after a client-side page transition (it already printed the theme). */
export function start({ navigated = false } = {}) {
  stop();

  // Smooth scroll, driven by GSAP's ticker so ScrollTrigger stays in sync.
  lenis = new Lenis({ autoRaf: false, lerp: 0.12 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(raf);
  gsap.ticker.lagSmoothing(0);

  document.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
    const handle = buildReveal(el);
    if (handle) reveals.set(el, handle);
  });

  document.addEventListener('toggle', onToggle, true);
  cursor = startCursor();
  cleanups = [scrollDots(), clippingTilt(), foldingAccordions(), marquees(lenis), teamStacks(), reprint(navigated)];
  ScrollTrigger.refresh();
}

export function stop() {
  reveals.forEach((r) => r.kill());
  reveals.clear();
  cleanups.forEach((c) => c());
  cleanups = [];
  ScrollTrigger.getAll().forEach((t) => t.kill());
  document.removeEventListener('toggle', onToggle, true);
  gsap.ticker.remove(raf);
  lenis?.destroy();
  lenis = undefined;
  cursor?.destroy();
  cursor = undefined;
}

/** Re-runs an element's reveal from the start (styleguide demos). */
export function replay(el: HTMLElement) {
  reveals.get(el)?.kill();
  const handle = buildReveal(el, { immediate: true });
  if (handle) reveals.set(el, handle);
}
