# PLAN.md — IFF 21 Website (Frontend)

How to use this file:
1. Make an empty folder and put `CLAUDE.md` and this `PLAN.md` in the root.
2. Make a `/docs` folder containing `konsep_iff_21.pdf`, plus screenshots of the moodboard and the FAQ prototype.
3. Open Claude Code in that folder.
4. Run the phases **one by one** by copying the prompts below. Don't one-shot.
5. After each phase: run `npm run dev`, check the result, and give feedback (screenshots help a lot) before moving on.

Scope: **frontend only**. Use placeholders for all photos, videos, and 3D models. Real assets get swapped in later.

---

## Checklist before starting
- [ ] Font licenses (Rushford Printed, Military Script, Etna Condensed, Futura). If they're not ready, fallbacks are used automatically.
- [ ] Theme / subtitle for the 21st edition (placeholder for now).
- [ ] Domain: check who controls `indonesianfilmfestival.com.au` and `iffaustralia.com`.
- [ ] Vercel + GitHub accounts for deploying.

---

## Phase 1: Setup + design system
```
Read CLAUDE.md and /docs. Scaffold the Astro + Tailwind project.
Build the design system first:
- CSS variables for the 4 themes, switched via data-theme on <body>.
- @font-face for all fonts with the fallbacks listed in CLAUDE.md (font files may be missing for now).
- Beige paper background: SVG noise texture plus faint low-opacity newspaper column text. No external images.
- Global grain overlay (SVG feTurbulence, pointer-events none).
- Typography components: DisplayTitle (huge Rushford, optional Military Script word overlapping at an angle in beige/gold, like the FAQ prototype), Kicker (Special Elite), body text.
- Placeholder system: a Media component that reads src/content/media.json and renders a labeled halftone placeholder ([IMG: key ratio] / [VIDEO: key ratio]) when the file doesn't exist yet. Create PLACEHOLDERS.md listing every key.
Make /styleguide show all 4 themes side by side, every font, and the placeholders.
```

## Phase 2: Halftone image pipeline
```
Write a build script (Node + sharp) that takes photos from /src/assets/raw and outputs halftone versions:
- grayscale → dot halftone (configurable dot size)
- two variants: pure black halftone, and duotone in each theme's primary color
- bottom edge fades to transparent (image melts into the color, like the prototype)
Hook into `npm run build`, add `npm run halftone`. If /raw is empty, skip gracefully (placeholders stay). Document in README.
```

## Phase 3: Content + components
```
Create content collections with placeholder data: films, events, schedule, sponsors, faq, team, media.
Build components: Navbar, Footer, Hero (one big halftone image + DisplayTitle + color splash overlay), FilmCard (newspaper-clipping style), ScheduleTable (classified-ad style), FAQ accordion, SponsorStrip, TeamGrid, VideoPlayer (placeholder-aware), Forms (UI only, TODO(backend), "coming soon" toast).
One main image per section, lots of negative space.
```

## Phase 4: Pages (static, no motion yet)
```
Build all pages: /, /sfc, /uts, /main-screening, /films/[slug], /program, /faq, /about, /sponsors, /volunteer.
Each event page uses its own data-theme. Home uses base and includes a strip showing the journey SFC → UTS → Main.
Everything must look good and be fully usable WITHOUT any animation. Check 375/768/1440.
```

## Phase 5: Motion foundation
```
Set up the motion system: Lenis + GSAP ScrollTrigger synced. Reusable reveal system via data-reveal="misregister|typewriter|fold|halftone-grow|fade-up" so any element can opt in.
Global: animated grain, custom halftone-dot cursor with ink trail (desktop only), Astro View Transitions where the next page's theme color "prints over" the previous one (riso plate effect).
Global reduced-motion kill switch. Show every reveal type on /styleguide.
```

## Phase 6: 3D halftone shader
```
Create a Three.js halftone post-processing shader: renders a scene as monochrome halftone dots in the current theme's primary color on the beige paper, with slight color misregistration and grain. Dot size controlled by a uniform (so scroll can drive it).
Demo on /styleguide with a placeholder low-poly film camera built from primitives (swap to /public/models/camera.glb later if provided). It rotates with the mouse and scroll.
Lazy-load (client:visible), dispose on page leave, and a static fallback for mobile/reduced motion.
```

## Phase 7: Hero + film strip (the 3D spots)
```
Home hero: halftone 3D camera. On scroll, its dots scatter and reassemble into the festival title (particles sampled from the title text).
Below: a pinned section with a 3D film strip scrolling horizontally through SFC → UTS → Main. Each frame changes the site theme color as it passes the center.
Mobile: replace with a looping halftone video placeholder ([VIDEO: hero-loop 9:16]).
```

## Phase 8: Spread motion to every page
```
Apply motion across ALL pages using the data-reveal system (not one-off code):
- misregistration reveal on every DisplayTitle
- halftone dot size tied to scroll on section images
- film cards: paper clippings with 3D tilt + lift on hover
- schedule rows type in (Special Elite, typewriter)
- FAQ accordion unfolds like folded paper
- sponsor marquee, speed follows scroll velocity
- team photos as a draggable paper stack
- event pages: theme color "re-prints" when entering
Every page and section should have some motion; nothing static and boring, but nothing that blocks content.
```

## Phase 9: Audit + polish
```
Performance and accessibility pass:
- Lighthouse on mobile throttling (target 90+), measure FPS during scroll animations
- lazy-load all Three.js, check for WebGL leaks
- reduced-motion disables everything; site still works without JS
- contrast check every theme, alt text, semantic HTML
- meta/OG per page, sitemap, favicon
Fix all issues found.
```

## Phase 10: Deploy + handover
```
Prepare for Vercel deploy. Write HANDOVER.md for next year's webmaster explaining, without code knowledge, how to:
- update films, schedule, FAQ, sponsors, team
- swap placeholders for real photos/videos (using PLACEHOLDERS.md + media.json)
- run the halftone pipeline on new photos
- change theme colors/fonts for a new edition
- deploy changes
```

---

## When swapping in real assets
```
I've added real assets to /src/assets/raw and /public/videos. Update media.json to use them, run the halftone pipeline, remove the placeholders that are now filled, and update PLACEHOLDERS.md.
```

## Iteration tips
- Paste screenshots or references (Awwwards: filter "WebGL" + "editorial") and say "this feel, in our riso style".
- Keep feedback specific: "the script word should overlap more", "halftone dots are too small", "motion is too slow on the film cards".
- If performance drops, ask: "profile and reduce the motion cost without removing the effect".

## Later (not now): backend
- Volunteer/contact form submissions, newsletter, possibly a CMS so committee members can edit without Git.
