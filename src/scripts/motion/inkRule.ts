/**
 * Ink rules (<InkRule />) as plucked strings. Each rule is a row of points on
 * springs, coupled to their neighbours:
 *   - idle: a slow, shallow travelling wave
 *   - pointer near the rule: the nearby points bend toward it (touch drag too)
 *   - fast scrolling: a wobble in the scroll direction
 * The colour plate trails the black rules, so the misregistration grows with
 * movement and settles back when still. Only visible rules are simulated.
 */
import type Lenis from 'lenis';
import gsap from 'gsap';

type Cleanup = () => void;

const N = 40; // points per rule
const REACH = 70; // px above/below the rule where the pointer has influence
const MAX_PULL = 22; // px
const SIGMA = 0.12; // pull width, as a fraction of the rule's width
const THIN_GAP = 4; // px between the thick and thin rule
const BASE_Y = 6; // resting line in viewBox units (= px, the svg is 12px tall)

interface Rule {
  el: HTMLElement;
  paths: { plate: SVGPathElement; thick: SVGPathElement; thin: SVGPathElement };
  y: Float32Array;
  v: Float32Array;
  lag: Float32Array;
  visible: boolean;
  phase: number;
  /** Position in the document, cached (reading layout every frame forces reflows). */
  box: { top: number; left: number; width: number; height: number };
}

function pathFor(y: Float32Array, base: number) {
  // Quadratic curve through the midpoints: smooth, and cheap to build.
  const x = (i: number) => (i / (N - 1)) * 1000;
  const yy = (i: number) => (base + y[i]).toFixed(2);
  let d = `M0 ${yy(0)}`;
  for (let i = 1; i < N - 1; i++) {
    const mx = (x(i) + x(i + 1)) / 2;
    const my = ((base + y[i] + base + y[i + 1]) / 2).toFixed(2);
    d += ` Q${x(i).toFixed(1)} ${yy(i)} ${mx.toFixed(1)} ${my}`;
  }
  return `${d} L1000 ${yy(N - 1)}`;
}

export function inkRules(lenis: Lenis | undefined): Cleanup {
  const els = [...document.querySelectorAll<HTMLElement>('[data-ink-rule]')];
  if (!els.length) return () => {};

  const rules: Rule[] = els.map((el, i) => {
    el.classList.add('is-live');
    const q = (c: string) => el.querySelector<SVGPathElement>(`.ink-rule__${c}`)!;
    return {
      el,
      paths: { plate: q('plate'), thick: q('thick'), thin: q('thin') },
      y: new Float32Array(N),
      v: new Float32Array(N),
      lag: new Float32Array(N),
      visible: false,
      phase: i * 1.7,
      box: { top: 0, left: 0, width: 1, height: 12 },
    };
  });

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      const r = rules.find((r) => r.el === e.target);
      if (r) r.visible = e.isIntersecting;
    });
  });
  rules.forEach((r) => io.observe(r.el));

  // Rules live in normal flow (never in pinned stages), so their document
  // position only changes when the layout does.
  const measure = () => {
    for (const r of rules) {
      const b = r.el.getBoundingClientRect();
      r.box = { top: b.top + scrollY, left: b.left + scrollX, width: b.width || 1, height: b.height };
    }
  };
  measure();
  const ro = new ResizeObserver(measure);
  ro.observe(document.body);
  window.addEventListener('resize', measure);

  const pointer = { x: -1e4, y: -1e4 };
  const onMove = (e: PointerEvent) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
  };
  const onLeave = () => {
    pointer.x = pointer.y = -1e4;
  };
  window.addEventListener('pointermove', onMove, { passive: true });
  document.documentElement.addEventListener('pointerleave', onLeave);

  const target = new Float32Array(N);
  const tick = (time: number, dtMs: number) => {
    const dt = Math.min(dtMs / 16.67, 2); // in 60fps frames
    const scrollV = lenis?.velocity ?? 0;
    for (const r of rules) {
      if (!r.visible) continue;
      const left = r.box.left - scrollX;
      const box = { top: r.box.top - scrollY, left, right: left + r.box.width, width: r.box.width, height: r.box.height };
      const midY = box.top + box.height / 2;
      const dy = pointer.y - midY;
      const near = Math.abs(dy) < REACH && pointer.x >= box.left - 40 && pointer.x <= box.right + 40;
      const px = (pointer.x - box.left) / box.width;
      // Closer pointer pulls harder; it can't pull further than MAX_PULL.
      const pull = near ? Math.max(-MAX_PULL, Math.min(MAX_PULL, dy)) * (1 - Math.abs(dy) / REACH) ** 0.5 : 0;

      for (let i = 0; i < N; i++) {
        const u = i / (N - 1);
        const ends = Math.sin(Math.PI * u); // ends stay pinned
        const idle = Math.sin(u * 9 + time * 1.3 + r.phase) * 1.2 + Math.sin(u * 4 - time * 0.7) * 0.6;
        const g = near ? Math.exp(-(((u - px) / SIGMA) ** 2)) : 0;
        target[i] = (idle + pull * g) * ends;
      }
      const { y, v, lag } = r;
      for (let i = 1; i < N - 1; i++) {
        const spring = (target[i] - y[i]) * 0.06;
        const string = (y[i - 1] + y[i + 1] - 2 * y[i]) * 0.25;
        v[i] += (spring + string) * dt;
        v[i] += Math.sin((Math.PI * i) / (N - 1)) * scrollV * 0.004 * dt;
        v[i] *= 0.9 ** dt;
      }
      for (let i = 1; i < N - 1; i++) {
        y[i] += v[i] * dt;
        lag[i] += (y[i] - lag[i]) * Math.min(1, 0.18 * dt);
      }
      r.paths.thick.setAttribute('d', pathFor(y, BASE_Y));
      r.paths.thin.setAttribute('d', pathFor(y, BASE_Y + THIN_GAP));
      r.paths.plate.setAttribute('d', pathFor(lag, BASE_Y + 1.5));
    }
  };
  gsap.ticker.add(tick);

  return () => {
    gsap.ticker.remove(tick);
    io.disconnect();
    ro.disconnect();
    window.removeEventListener('resize', measure);
    window.removeEventListener('pointermove', onMove);
    document.documentElement.removeEventListener('pointerleave', onLeave);
    rules.forEach((r) => r.el.classList.remove('is-live'));
  };
}
