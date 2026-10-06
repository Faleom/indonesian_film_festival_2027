/**
 * Site-wide effects (Phase 8), each opt-in through markup so pages need no
 * custom code. Every setup returns a cleanup run before the next page swap.
 *
 *   .ph / .media--halftone       halftone dot size + parallax tied to scroll
 *   .clipping                    3D tilt + lift following the pointer (desktop)
 *   details.faq-item             answers unfold like folded paper
 *   [data-ink-wipe]              section break swept across by scroll
 *   [data-marquee]               sponsor marquee, speed follows scroll velocity; drag/swipe sideways
 *   body[data-reprint]           theme colour re-prints over the page on load
 */
import gsap from 'gsap';
import type Lenis from 'lenis';

type Cleanup = () => void;
const desktop = () => matchMedia('(hover: hover) and (pointer: fine)').matches;

/** Placeholder dots shrink as an image scrolls to the centre; real halftones drift in scale. */
export function scrollDots(): Cleanup {
  const tweens: gsap.core.Tween[] = [];
  // Not the hero's clippings: they sit in a pinned stage, so the tween would
  // repaint their blur/contrast filters on every frame of the hero animation.
  document.querySelectorAll<HTMLElement>('.ph:not(.hero3d__decor .ph)').forEach((el) => {
    tweens.push(
      gsap.fromTo(
        el,
        { '--dot': '13px', '--dot-blur': '6px' },
        {
          '--dot': '7px',
          '--dot-blur': '3.2px',
          ease: 'none',
          scrollTrigger: { trigger: el, start: 'top bottom', end: 'center 40%', scrub: true },
        },
      ),
    );
  });
  document.querySelectorAll<HTMLElement>('.media--halftone > *').forEach((el) => {
    el.style.willChange = 'transform';
    tweens.push(
      gsap.fromTo(el, { scale: 1.12 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } }),
    );
  });
  return () => tweens.forEach((t) => (t.scrollTrigger?.kill(), t.kill()));
}

/** Clippings tilt toward the pointer and lift off the page. */
export function clippingTilt(): Cleanup {
  if (!desktop()) return () => {};
  const offs: Cleanup[] = [];
  document.querySelectorAll<HTMLElement>('.clipping').forEach((card) => {
    const paper = card.querySelector<HTMLElement>('.clipping__paper') ?? card;
    gsap.set(paper, { transformPerspective: 800, transformOrigin: '50% 50%' });
    const rx = gsap.quickTo(paper, 'rotationX', { duration: 0.4, ease: 'power3.out' });
    const ry = gsap.quickTo(paper, 'rotationY', { duration: 0.4, ease: 'power3.out' });
    const z = gsap.quickTo(paper, 'z', { duration: 0.4, ease: 'power3.out' });
    const move = (e: PointerEvent) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      ry(x * 14);
      rx(-y * 12);
      z(30);
    };
    const leave = () => (rx(0), ry(0), z(0));
    card.addEventListener('pointermove', move);
    card.addEventListener('pointerleave', leave);
    offs.push(() => {
      card.removeEventListener('pointermove', move);
      card.removeEventListener('pointerleave', leave);
      gsap.set(paper, { clearProps: 'transform' });
    });
  });
  return () => offs.forEach((f) => f());
}

/** FAQ answers unfold from the top like a folded sheet, and fold back up. */
export function foldingAccordions(): Cleanup {
  const offs: Cleanup[] = [];
  document.querySelectorAll<HTMLDetailsElement>('details.faq-item').forEach((item) => {
    const summary = item.querySelector('summary');
    const answer = item.querySelector<HTMLElement>('.faq-item__answer');
    if (!summary || !answer) return;
    let tween: gsap.core.Timeline | undefined;
    const onClick = (e: MouseEvent) => {
      e.preventDefault();
      tween?.kill();
      if (!item.open) {
        item.open = true;
        tween = gsap
          .timeline()
          .fromTo(answer, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: 0.45, ease: 'power2.out' })
          .fromTo(
            answer,
            { rotationX: -80, transformPerspective: 700, transformOrigin: '50% 0%' },
            { rotationX: 0, duration: 0.7, ease: 'back.out(1.4)', clearProps: 'transform' },
            0,
          );
      } else {
        tween = gsap
          .timeline({ onComplete: () => ((item.open = false), gsap.set(answer, { clearProps: 'all' })) })
          .to(answer, { rotationX: 70, transformPerspective: 700, transformOrigin: '50% 0%', opacity: 0, duration: 0.3, ease: 'power2.in' })
          .to(answer, { height: 0, duration: 0.3, ease: 'power2.inOut' }, 0.1);
      }
    };
    summary.addEventListener('click', onClick);
    offs.push(() => {
      summary.removeEventListener('click', onClick);
      tween?.kill();
      gsap.set(answer, { clearProps: 'all' });
    });
  });
  return () => offs.forEach((f) => f());
}

/**
 * Infinite marquee; scrolling the page pushes it faster, in the scroll direction.
 * It can also be moved by hand: drag / swipe sideways or scroll a trackpad
 * horizontally, and it glides on with a little inertia before the drift resumes.
 * Runs only while on screen, and the loop width is cached (reading scrollWidth
 * every frame forced a layout on frames shared with the 3D and the rules).
 */
export function marquees(lenis: Lenis | undefined): Cleanup {
  const offs: Cleanup[] = [];
  document.querySelectorAll<HTMLElement>('[data-marquee]').forEach((root) => {
    const track = root.querySelector<HTMLElement>('[data-marquee-track]');
    if (!track) return;
    root.classList.add('is-running');
    let x = 0;
    let boost = 0;
    let fling = 0; // px per second left over from a drag or a horizontal scroll
    const base = Number(root.dataset.marqueeSpeed ?? 40); // px per second
    let half = track.scrollWidth / 2; // track holds the items twice
    const ro = new ResizeObserver(() => (half = track.scrollWidth / 2));
    ro.observe(track);

    let drag: { id: number; lastX: number; lastT: number; travel: number; moved: boolean } | null = null;
    let suppressClick = false;
    const tick = (_t: number, dtMs: number) => {
      if (!drag?.moved) {
        const v = lenis?.velocity ?? 0;
        boost += (v * 25 - boost) * 0.1;
        x -= ((base + Math.abs(boost)) * Math.sign(boost || 1) * dtMs) / 1000;
        x += (fling * dtMs) / 1000;
        fling *= Math.exp(-dtMs / 350);
      }
      if (half > 0) x = ((x % half) - half) % half;
      gsap.set(track, { x });
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      drag = { id: e.pointerId, lastX: e.clientX, lastT: e.timeStamp, travel: 0, moved: false };
    };
    const onMove = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.lastX;
      const dt = Math.max(1, e.timeStamp - drag.lastT);
      drag.travel += Math.abs(dx);
      if (!drag.moved && drag.travel > 6) {
        // Only now capture, so a plain tap still reaches the sponsor link.
        drag.moved = true;
        root.setPointerCapture(e.pointerId);
        root.classList.add('is-dragging');
      }
      if (drag.moved) {
        x += dx;
        fling = (dx / dt) * 1000;
      }
      drag.lastX = e.clientX;
      drag.lastT = e.timeStamp;
    };
    const onUp = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      suppressClick = drag.moved;
      if (e.timeStamp - drag.lastT > 80) fling = 0; // held still before letting go
      drag = null;
      root.classList.remove('is-dragging');
    };
    const onClick = (e: MouseEvent) => {
      if (!suppressClick) return;
      suppressClick = false;
      e.preventDefault();
      e.stopPropagation();
    };
    // Trackpads and shift+wheel scroll it sideways; vertical wheel still scrolls the page.
    const onWheel = (e: WheelEvent) => {
      const dx = e.deltaX || (e.shiftKey ? e.deltaY : 0);
      if (Math.abs(dx) <= Math.abs(e.shiftKey ? 0 : e.deltaY)) return;
      e.preventDefault();
      x -= dx;
      fling = 0;
    };
    root.addEventListener('pointerdown', onDown);
    root.addEventListener('pointermove', onMove);
    root.addEventListener('pointerup', onUp);
    root.addEventListener('pointercancel', onUp);
    root.addEventListener('click', onClick, true);
    root.addEventListener('wheel', onWheel, { passive: false });
    // Links and logos shouldn't start a native image/link drag.
    const noNativeDrag = (e: DragEvent) => e.preventDefault();
    root.addEventListener('dragstart', noNativeDrag);

    let running = false;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting === running) return;
      running = entry.isIntersecting;
      if (running) gsap.ticker.add(tick);
      else gsap.ticker.remove(tick);
    });
    io.observe(root);
    offs.push(() => {
      io.disconnect();
      ro.disconnect();
      gsap.ticker.remove(tick);
      root.removeEventListener('pointerdown', onDown);
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerup', onUp);
      root.removeEventListener('pointercancel', onUp);
      root.removeEventListener('click', onClick, true);
      root.removeEventListener('wheel', onWheel);
      root.removeEventListener('dragstart', noNativeDrag);
      root.classList.remove('is-running', 'is-dragging');
      gsap.set(track, { clearProps: 'transform' });
    });
  });
  return () => offs.forEach((f) => f());
}

/**
 * Event pages: the theme colour prints over the page as halftone dots that
 * shrink away, like a fresh riso pass. Skipped after a client-side
 * navigation, because the page transition already printed it.
 */
export function reprint(skip: boolean): Cleanup {
  if (skip || !document.body.hasAttribute('data-reprint')) return () => {};
  const plate = document.createElement('div');
  plate.className = 'reprint-plate';
  plate.setAttribute('aria-hidden', 'true');
  document.body.append(plate);
  const tween = gsap.fromTo(
    plate,
    { '--rp': '14px' },
    { '--rp': '0px', duration: 0.9, ease: 'power2.inOut', onComplete: () => plate.remove() },
  );
  return () => (tween.kill(), plate.remove());
}

/**
 * Section breaks (InkWipe): scroll sweeps the ink band across. Scrubbed, so it
 * runs both ways; one custom property per frame, no layout reads.
 */
export function inkWipes(): Cleanup {
  const tweens = Array.from(document.querySelectorAll<HTMLElement>('[data-ink-wipe]')).map((el) =>
    gsap.fromTo(
      el,
      { '--w': 0 },
      { '--w': 1, ease: 'none', scrollTrigger: { trigger: el, start: 'top 95%', end: 'top 35%', scrub: 0.6 } },
    ),
  );
  return () =>
    tweens.forEach((t) => {
      t.scrollTrigger?.kill();
      t.kill();
      gsap.set(t.targets(), { clearProps: '--w' });
    });
}
