/**
 * Halftone-dot cursor with an ink trail. Desktop only (fine pointer, hover,
 * wide screen). The trail is drawn on a canvas as dots snapped to a halftone
 * grid that shrink as the ink "dries". Native cursor comes back over form fields.
 */
import gsap from 'gsap';

export interface CursorHandle {
  destroy(): void;
}

const GRID = 9; // trail dot spacing, px
const LIFE = 0.55; // seconds a trail dot lives
const MAX_R = 3.6; // trail dot radius, px

export function startCursor(): CursorHandle | undefined {
  const desktop = matchMedia('(hover: hover) and (pointer: fine) and (min-width: 1024px)').matches;
  if (!desktop) return undefined;

  const root = document.documentElement;
  const dot = document.createElement('div');
  dot.className = 'cursor';
  dot.setAttribute('aria-hidden', 'true');
  const canvas = document.createElement('canvas');
  canvas.className = 'cursor-trail';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas, dot);
  root.classList.add('has-cursor');

  const ctx = canvas.getContext('2d')!;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const resize = () => {
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();

  const ink = getComputedStyle(document.body).getPropertyValue('--c-primary').trim() || '#000';
  const moveX = gsap.quickTo(dot, 'x', { duration: 0.18, ease: 'power3.out' });
  const moveY = gsap.quickTo(dot, 'y', { duration: 0.18, ease: 'power3.out' });

  // Trail: one dot per grid cell, keyed by cell, refreshed when the pointer passes again.
  const cells = new Map<string, { x: number; y: number; age: number }>();
  let last: { x: number; y: number } | undefined;

  const stamp = (x: number, y: number) => {
    const cx = Math.round(x / GRID);
    const cy = Math.round(y / GRID);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const px = (cx + dx) * GRID;
        const py = (cy + dy) * GRID;
        const falloff = Math.hypot(px - x, py - y) / (GRID * 1.6);
        if (falloff > 1) continue;
        const key = `${cx + dx},${cy + dy}`;
        const age = LIFE * falloff * 0.8; // dots further from the path start "older" (smaller)
        const existing = cells.get(key);
        if (!existing || existing.age > age) cells.set(key, { x: px, y: py, age });
      }
    }
  };

  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    dot.classList.add('is-visible');
    moveX(e.clientX);
    moveY(e.clientY);
    // Fill the gap between samples so fast moves leave a continuous trail.
    const from = last ?? { x: e.clientX, y: e.clientY };
    const steps = Math.max(1, Math.ceil(Math.hypot(e.clientX - from.x, e.clientY - from.y) / (GRID / 2)));
    for (let i = 1; i <= steps; i++) {
      stamp(from.x + ((e.clientX - from.x) * i) / steps, from.y + ((e.clientY - from.y) * i) / steps);
    }
    last = { x: e.clientX, y: e.clientY };
  };

  const onOver = (e: PointerEvent) => {
    const t = e.target as Element;
    const field = t.closest('input, textarea, select');
    dot.classList.toggle('is-field', !!field);
    dot.classList.toggle('is-hover', !field && !!t.closest('a, button, summary, label, [role="button"]'));
  };
  const onDown = () => dot.classList.add('is-down');
  const onUp = () => dot.classList.remove('is-down');
  const onLeave = () => {
    dot.classList.remove('is-visible');
    last = undefined;
  };

  const draw = (_time: number, deltaMs: number) => {
    if (cells.size === 0) return;
    const dt = deltaMs / 1000;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.fillStyle = ink;
    for (const [key, c] of cells) {
      c.age += dt;
      if (c.age >= LIFE) {
        cells.delete(key);
        continue;
      }
      const r = MAX_R * (1 - c.age / LIFE);
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (cells.size === 0) ctx.clearRect(0, 0, innerWidth, innerHeight);
  };

  window.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerover', onOver, { passive: true });
  window.addEventListener('pointerdown', onDown);
  window.addEventListener('pointerup', onUp);
  document.documentElement.addEventListener('pointerleave', onLeave);
  window.addEventListener('resize', resize);
  gsap.ticker.add(draw);

  return {
    destroy() {
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerover', onOver);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('resize', resize);
      gsap.ticker.remove(draw);
      dot.remove();
      canvas.remove();
      root.classList.remove('has-cursor');
    },
  };
}
