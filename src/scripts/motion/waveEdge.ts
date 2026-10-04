/**
 * Wave edges (<WaveEdge />): a broad, liquid wave rather than a string.
 *   - idle: a few long sine waves rolling slowly sideways
 *   - pointer near: a wide, soft swell follows it (eased, never snappy)
 *   - fast scrolling: the swell deepens a little
 * The colour plate under the fill trails it, so the misregistration shows
 * mostly while the wave moves. Only visible edges are animated.
 */
import type Lenis from 'lenis';
import gsap from 'gsap';

type Cleanup = () => void;

const N = 28; // control points across the width
const W = 1600; // viewBox width
const BAND_TOP = 140; // the animated svg band starts this far down the edge
const BASE = 96; // resting edge, px from the top of the band
const IDLE = 30; // idle wave height, px
const SWELL = 30; // max swell toward the pointer, px
const REACH = 220; // px above/below the edge where the pointer is felt
const SPREAD = 0.2; // swell width, as a fraction of the edge's width

interface Edge {
  el: HTMLElement;
  fill: SVGPathElement;
  plate: SVGPathElement;
  y: Float32Array;
  lag: Float32Array;
  swellX: number; // eased pointer position (0..1)
  swell: number; // eased swell amount (px)
  visible: boolean;
}

/** Smooth closed shape: Catmull-Rom through the points, then up to the top edge. */
function shape(y: Float32Array, shift: number) {
  const x = (i: number) => (i / (N - 1)) * W;
  const py = (i: number) => BASE + y[Math.max(0, Math.min(N - 1, i))] + shift;
  let d = `M0 ${py(0).toFixed(1)}`;
  for (let i = 0; i < N - 1; i++) {
    const c1x = x(i) + (x(i + 1) - x(i - 1 < 0 ? 0 : i - 1)) / 6;
    const c1y = py(i) + (py(i + 1) - py(i - 1)) / 6;
    const c2x = x(i + 1) - (x(i + 2 > N - 1 ? N - 1 : i + 2) - x(i)) / 6;
    const c2y = py(i + 1) - (py(i + 2) - py(i)) / 6;
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${x(i + 1).toFixed(1)} ${py(i + 1).toFixed(1)}`;
  }
  return `${d} L${W} 0 L0 0 Z`;
}

export function waveEdges(lenis: Lenis | undefined): Cleanup {
  const els = [...document.querySelectorAll<HTMLElement>('[data-wave-edge]')];
  if (!els.length) return () => {};

  const edges: Edge[] = els.map((el) => ({
    el,
    fill: el.querySelector<SVGPathElement>('.wave-edge__fill')!,
    plate: el.querySelector<SVGPathElement>('.wave-edge__plate')!,
    y: new Float32Array(N),
    lag: new Float32Array(N),
    swellX: 0.5,
    swell: 0,
    visible: false,
  }));

  const io = new IntersectionObserver((entries) =>
    entries.forEach((e) => {
      const edge = edges.find((x) => x.el === e.target);
      if (edge) edge.visible = e.isIntersecting;
    }),
  );
  edges.forEach((e) => io.observe(e.el));

  const pointer = { x: -1e4, y: -1e4 };
  const onMove = (e: PointerEvent) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
  };
  window.addEventListener('pointermove', onMove, { passive: true });

  const tick = (time: number, dtMs: number) => {
    const k = Math.min(1, (dtMs / 16.67) * 0.06); // easing per frame
    const scroll = Math.min(Math.abs(lenis?.velocity ?? 0) * 0.6, 12);
    for (const e of edges) {
      if (!e.visible) continue;
      const box = e.el.getBoundingClientRect();
      const dy = pointer.y - (box.top + BAND_TOP + BASE);
      const near = Math.abs(dy) < REACH && pointer.x >= box.left && pointer.x <= box.right;
      // The swell rises toward the pointer (above the edge: up, below: down).
      const want = near ? Math.sign(dy) * SWELL * (1 - Math.abs(dy) / REACH) : 0;
      e.swell += (want - e.swell) * k;
      if (near) e.swellX += ((pointer.x - box.left) / box.width - e.swellX) * k;

      for (let i = 0; i < N; i++) {
        const u = i / (N - 1);
        const idle =
          Math.sin(u * 5.2 + time * 0.55) * IDLE * 0.6 +
          Math.sin(u * 2.3 - time * 0.32 + 1.3) * IDLE * 0.5 +
          Math.sin(u * 9.1 + time * 0.9) * IDLE * 0.15;
        const g = Math.exp(-(((u - e.swellX) / SPREAD) ** 2));
        const target = idle + (e.swell + scroll) * g;
        e.y[i] += (target - e.y[i]) * 0.2;
        e.lag[i] += (e.y[i] - e.lag[i]) * 0.08;
      }
      e.fill.setAttribute('d', shape(e.y, 0));
      e.plate.setAttribute('d', shape(e.lag, 0)); // the plate path is offset 6px in the markup
    }
  };
  gsap.ticker.add(tick);

  return () => {
    gsap.ticker.remove(tick);
    io.disconnect();
    window.removeEventListener('pointermove', onMove);
  };
}
