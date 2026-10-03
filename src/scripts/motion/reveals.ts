/**
 * Reveal system. Any element opts in with a data attribute, no new code:
 *
 *   data-reveal="fade-up | misregister | typewriter | fold | halftone-grow"
 *   data-reveal-delay="0.2"     seconds before it starts
 *   data-reveal-children        animate each child in turn instead of the element
 *   data-reveal-stagger="0.1"   gap between children (default 0.08)
 *
 * Content is never hidden before this script runs. Elements already on screen
 * when the page loads get a "soft" reveal (they stay visible and animate into
 * place), so the main content paints immediately; elements further down get
 * the full reveal as they scroll in.
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

interface BuildContext {
  targets: HTMLElement[];
  tl: gsap.core.Timeline;
  stagger: number;
  /** Already visible at load: don't hide it, just animate it into place. */
  soft: boolean;
}

type Builder = (ctx: BuildContext) => void | (() => void);

const builders: Record<RevealType, Builder> = {
  'fade-up': ({ targets, tl, stagger, soft }) => {
    tl.fromTo(
      targets,
      { autoAlpha: soft ? 1 : 0, y: soft ? 18 : 36 },
      { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger },
    );
  },

  // Colour plates start out of register and slide into place (filter in motion.css).
  misregister: ({ targets, tl, stagger, soft }) => {
    targets.forEach((t) => t.classList.add('reveal-mis'));
    tl.fromTo(
      targets,
      { autoAlpha: soft ? 1 : 0, '--mis': 1, x: -4 },
      { autoAlpha: 1, '--mis': 0, x: 0, duration: 1.2, ease: 'expo.out', stagger },
    );
    return () => targets.forEach((t) => t.classList.remove('reveal-mis'));
  },

  // Characters appear one at a time with a caret, like a typewriter. The text is
  // only split into characters while it types, then restored.
  typewriter: ({ targets, tl, soft }) => {
    const splits: SplitText[] = [];
    if (!soft) gsap.set(targets, { autoAlpha: 0 });
    targets.forEach((t) => {
      tl.add(() => {
        const split = SplitText.create(t, { type: 'words,chars', aria: 'none' });
        splits.push(split);
        const chars = split.chars as HTMLElement[];
        let prev: HTMLElement | undefined;
        gsap.set(t, { autoAlpha: 1 });
        gsap.fromTo(
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
            onComplete: () => {
              gsap.delayedCall(0.4, () => {
                prev?.classList.remove('tw-caret');
                split.revert();
              });
            },
          },
        );
      });
    });
    tl.to({}, { duration: 1.8 }); // keep the timeline alive while it types
    return () => splits.forEach((s) => s.revert());
  },

  // Unfolds from the top edge like a folded newspaper.
  fold: ({ targets, tl, stagger, soft }) => {
    tl.fromTo(
      targets,
      { autoAlpha: soft ? 1 : 0, rotateX: soft ? -35 : -78, transformPerspective: 900, transformOrigin: '50% 0%' },
      { autoAlpha: 1, rotateX: 0, duration: 1.1, ease: 'power3.out', stagger },
    );
  },

  // Revealed through halftone dots that grow until solid (mask in motion.css).
  'halftone-grow': ({ targets, tl, stagger, soft }) => {
    targets.forEach((t) => t.classList.add('reveal-ht'));
    tl.fromTo(
      targets,
      { autoAlpha: 1, '--ht': soft ? '6px' : '0px' },
      { '--ht': '13px', duration: soft ? 0.9 : 1.3, ease: 'power2.inOut', stagger },
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
  const rect = el.getBoundingClientRect();
  const soft = !immediate && rect.top < innerHeight && rect.bottom > 0;
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
  // fromTo() renders its start state immediately, so off-screen content is
  // hidden before it scrolls into view and nothing flashes.
  cleanup = build({ targets, tl, stagger, soft });

  const trigger =
    immediate || soft
      ? undefined
      : ScrollTrigger.create({ trigger: el, start: 'top 88%', once: true, onEnter: () => tl.play() });
  if (immediate || soft) tl.play();

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
