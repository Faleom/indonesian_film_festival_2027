/**
 * Reveal system. Any element opts in with a data attribute, no new code:
 *
 *   data-reveal="fade-up | misregister | typewriter | fold | halftone-grow"
 *   data-reveal-delay="0.2"     seconds before it starts
 *   data-reveal-children        animate each child in turn instead of the element
 *   data-reveal-stagger="0.1"   gap between children (default 0.08)
 *
 * Elements start hidden only while html.motion-js is set (see motion.css),
 * so without JS or with motion off everything is simply visible.
 */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

export type RevealType = 'fade-up' | 'misregister' | 'typewriter' | 'fold' | 'halftone-grow';

export interface RevealHandle {
  kill(): void;
}

// Inline props the reveals touch; cleared afterwards without wiping other inline styles.
const CLEAR = 'opacity,visibility,transform,translate,rotate,scale,--mis,--ht';

type Builder = (targets: HTMLElement[], tl: gsap.core.Timeline, stagger: number) => void | (() => void);

const builders: Record<RevealType, Builder> = {
  'fade-up': (targets, tl, stagger) => {
    tl.fromTo(targets, { autoAlpha: 0, y: 36 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger });
  },

  // Colour plates start out of register and slide into place (filter in motion.css).
  misregister: (targets, tl, stagger) => {
    targets.forEach((t) => t.classList.add('reveal-mis'));
    tl.fromTo(
      targets,
      { autoAlpha: 0, '--mis': 1, x: -4 },
      { autoAlpha: 1, '--mis': 0, x: 0, duration: 1.2, ease: 'expo.out', stagger },
    );
    return () => targets.forEach((t) => t.classList.remove('reveal-mis'));
  },

  // Characters appear one at a time with a caret, like a typewriter.
  typewriter: (targets, tl) => {
    const splits: SplitText[] = [];
    targets.forEach((t) => {
      const split = SplitText.create(t, { type: 'words,chars', aria: 'auto' });
      splits.push(split);
      const chars = split.chars as HTMLElement[];
      let prev: HTMLElement | undefined;
      tl.set(t, { autoAlpha: 1 });
      tl.fromTo(
        chars,
        { autoAlpha: 0 },
        {
          autoAlpha: 1,
          duration: 0.01,
          ease: 'none',
          stagger: {
            each: Math.min(0.045, 1.6 / Math.max(chars.length, 1)),
            onStart() {
              prev?.classList.remove('tw-caret');
              prev = this.targets()[0] as HTMLElement;
              prev.classList.add('tw-caret');
            },
          },
        },
      );
      tl.call(() => prev?.classList.remove('tw-caret'), undefined, '+=0.5');
    });
    return () => splits.forEach((s) => s.revert());
  },

  // Unfolds from the top edge like a folded newspaper.
  fold: (targets, tl, stagger) => {
    tl.fromTo(
      targets,
      { autoAlpha: 0, rotateX: -78, transformPerspective: 900, transformOrigin: '50% 0%' },
      { autoAlpha: 1, rotateX: 0, duration: 1.1, ease: 'power3.out', stagger },
    );
  },

  // Revealed through halftone dots that grow until solid (mask in motion.css).
  'halftone-grow': (targets, tl, stagger) => {
    targets.forEach((t) => t.classList.add('reveal-ht'));
    tl.fromTo(
      targets,
      { autoAlpha: 1, '--ht': '0px' },
      { '--ht': '13px', duration: 1.3, ease: 'power2.inOut', stagger },
    );
    return () => targets.forEach((t) => t.classList.remove('reveal-ht'));
  },
};

export function buildReveal(el: HTMLElement, { immediate = false } = {}): RevealHandle | undefined {
  const type = el.dataset.reveal as RevealType;
  const build = builders[type];
  if (!build) {
    console.warn(`[reveal] Unknown data-reveal="${type}"`, el);
    return undefined;
  }

  const useChildren = el.hasAttribute('data-reveal-children');
  const targets = useChildren ? (Array.from(el.children) as HTMLElement[]) : [el];
  const stagger = Number(el.dataset.revealStagger ?? 0.08);
  el.classList.remove('is-revealed');

  let cleanup: void | (() => void);
  const tl = gsap.timeline({
    paused: true,
    delay: Number(el.dataset.revealDelay ?? 0),
    onComplete() {
      cleanup?.();
      gsap.set(targets, { clearProps: CLEAR });
      el.classList.add('is-revealed');
    },
  });
  // fromTo() renders its hidden start state immediately, so nothing flashes before the trigger.
  cleanup = build(targets, tl, stagger);

  const trigger = immediate
    ? undefined
    : ScrollTrigger.create({ trigger: el, start: 'top 88%', once: true, onEnter: () => tl.play() });
  if (immediate) tl.play();

  return {
    kill() {
      trigger?.kill();
      tl.kill();
      cleanup?.();
      gsap.set(targets, { clearProps: CLEAR });
      el.classList.add('is-revealed');
    },
  };
}
