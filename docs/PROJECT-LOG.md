# Project log: 21st IFF website

What was built, in what order, the decisions behind it, and what we learned, so next
year's team doesn't have to rediscover it. For how-to steps see [`HANDOVER.md`](../HANDOVER.md);
for commands and internals see [`README.md`](../README.md).

Built 3–4 October 2026 with Claude Code (Opus), directed and tested by Faleom.
Commit hashes refer to `main` on GitHub.

---

## 1. Timeline

### 3 Oct 2026: foundations (Phases 1–10 of `PLAN.md`)

| Commit | What |
|---|---|
| `5841d91` | Phases 1–5: Astro + Tailwind, four event themes, paper + grain, typography components, placeholder-aware `<Media>`, `/styleguide`; halftone photo pipeline (sharp); content files and components; all pages working without JS; GSAP + Lenis motion, `data-reveal` system, page transitions, reduced-motion kill switch |
| `91c83fc` | Phase 6: halftone 3D shader (`<HalftoneCamera>`); corrected the four events |
| `0b369ea` | Removed Program and Volunteer pages and an invented schedule (rule: no invented content) |
| `177dc3c` | Phase 7: scroll-driven home hero (camera → dots → title) and 3D film strip |
| `7a7426f` | Phase 8: motion on every page, crumpled paper background |
| `f1f2b6e` | Removed script words that weren't part of real titles |
| `621ce29` | Fonts, sharper film strip, editable strip frames (`events.json` → `strip`), favicon pipeline |
| `d246689` | Pre-bundled 3D/motion deps (dev server served stale chunks) |
| `fd25935` | Rushford Printed + Military Scribe; dropped Etna (paid) for Oswald |
| `8a577a4` | Hero camera fits narrow screens, keeps the right theme colour |
| `daee786` | Phases 9–10: audit fixes, Vercel deployment prep |
| `b9bdcd5` | Team grid for a big committee; 3D on phones |

### 4 Oct 2026: polish, performance, real-device fixes

| Commit | What |
|---|---|
| `2a5e00d` | **New default looks.** Hero "solid": the camera is a lit 3D object printed as halftone, then dissolves into particles that form the title (`?hero=classic` keeps the old all-dots version). Film strip "solid": each picture carries its own halftone, locked to the image, so photos stay readable and don't shimmer (`?strip=classic`). Video backdrop behind the camera, print-shop decoration (clippings, crop/registration marks, colour strip), wave edge between hero and strip, section rules that bend toward the pointer, Motion toggle moved to the top bar, ticket "coming soon" message, first performance pass (60 fps on an M4 Air at 2x, was 30–53) |
| `d6fb8b6` | Safari: progress measured against the sticky stage, not `innerHeight`; frame-rate independent easing |
| `c35a1d7` | **iPhone shake fixed:** removed `overflow-x: clip` from an ancestor of the sticky 3D sections |
| `cc0f89f` | Fast-scroll stutter on phones: film strip built while idle, textures/shaders prepared up front, strip re-inks only its own stage (not `<body>`) |
| `6e54676` | Loading screen (film countdown leader), 1.4 s page transition, paper covers the full screen on Android |
| `08ceb0d` | Stopped hidden work: marquee off screen, 3D behind the loader, HUD rewrites |
| `802f729`, `82b3359` | Real IFF logo for the site icons and the header |
| `74e0266` | Empty commit to re-trigger a Vercel deploy that never started |

---

## 2. How the main pieces work (short version)

- **Halftone everywhere.** Photos are converted to dots at build time (`scripts/halftone.mjs`).
  3D scenes render normally, then a shader redraws them as dots: dot size follows darkness,
  a second ink in the theme's dark colour is slightly offset ("misregistration"), plus grain.
- **Hero.** About 7,500 points, each with three "homes": on the camera's surface, in a
  scattered cloud, and on the title (sampled from the real fonts). Scroll progress (0 → 1)
  moves every point between its homes. No video, no swapping: the same dots become the title.
- **Film strip.** A curved row of frames per event; as an event reaches the centre, the strip
  re-inks in that event's colours. Frames come from `events.json` → `strip`.
- **Performance guards** (`src/scripts/three/post.ts`): the scene behind the halftone is
  rendered at ~4 texels per dot (not full resolution), rendering is capped at 60 fps, and
  resolution steps down only if a device stays slow for ~2 s. `?quality=full` disables that
  for measuring.

---

## 3. What we learned

### Bugs that only real devices showed
| Symptom | Device | Cause | Fix |
|---|---|---|---|
| Hero and film strip shake **while the page is moving** (finger down or gliding), stop when still | iPhone (Safari) | An ancestor with `overflow-x: clip` makes Safari recompute `position: sticky` every scroll frame | No overflow clip above sticky elements; clip bleeding things in a full-width wrapper (`.bleed-clip`) instead |
| Bottom of the screen plain/white once the address bar hides | Android (Chrome) | Fixed layer with `inset: 0` is sized to the small viewport | Fixed full-screen layers use `height: 100lvh` |
| One big hitch when swiping fast down the home page | Mid-range Android | Film strip was built when it neared the screen, mid-scroll | Build it while the browser is idle (or behind the loading screen) |
| Film strip much laggier than the hero | Mid-range Android | Changing `data-theme` on `<body>` with an animated colour transition restyled the whole page every frame; the off-screen hero also redrew on every theme change | Re-theme only the strip's stage; ignore those changes for other scenes |
| Fans "like a jet" | Windows laptop | Full-resolution rendering at 144 Hz | Render at dot resolution; 60 fps cap |
| Lag right after testing | MacBook Air | Thermal throttling (fanless) after many test runs | Not a site bug; re-test when cool |

### Measuring
- Headless Chrome on the Mac can use the real GPU (`--use-angle=metal`), and CPU throttling
  (4–6x) is a decent stand-in for a mid-range phone's main thread. It can't reproduce iOS
  Safari or a phone GPU: those need the real devices.
- Results vary a lot run to run: measure 3+ times before trusting a number.
- The best bug reports said *when* it happens (finger down vs. gliding, first time vs. always).

---

## 4. Do

- **Test on an iPhone and a mid-range Android** after any change to motion, the hero or the strip.
- Keep the **four events** fixed and **only real content**; mark unknowns as TBC.
- Put every image/video in `media.json` and every piece of copy in `src/content`.
- Do heavy setup **before** the user scrolls (behind the loader, or when the browser is idle),
  never on the frame something enters the screen.
- Animate things **only while they're visible**, and write to the DOM only when a value changes.
- Make smoothing time-based (`ease(rate, dt)` in `post.ts`), not per-frame.
- Keep Motion: Off and no-JS fully readable. Check WCAG AA contrast for every theme.
- Verify with screenshots before calling a visual change done.
- Push to `main` after each finished piece; check the Vercel deployment appeared.

## 5. Don't

- **Don't put `overflow: clip/hidden` on any ancestor of a `position: sticky` element**
  (the home hero and film strip). It shakes on iPhone.
- Don't size fixed full-screen layers with `inset: 0` or `100vh` alone on mobile; use `100lvh`.
- Don't use `background-attachment: fixed` (repaints the whole screen on every scroll frame).
- Don't change `data-theme` on `<body>` during scroll animations, and don't transition
  inherited colour variables on `<body>`.
- Don't read layout (`getBoundingClientRect`, `scrollWidth`) every frame after writing styles;
  cache positions and re-measure on resize.
- Don't render 3D at full device resolution behind a halftone, or above 60 fps.
- Don't run tickers or loops for things off screen (marquees, hidden scenes).
- Don't invent events, sessions, schedules or film details.
- Don't hotlink images from the internet; use placeholders until real files exist.
- Don't hardcode content in components.

---

## 6. Still open (as of 4 Oct 2026)

- Real photos and videos from the 20th edition (slots listed in `PLACEHOLDERS.md`), then
  re-test on the A56 and iPhone.
- Real lineup, sponsors and team (current ones are placeholders).
- Real 3D camera model (`public/models/camera.glb`).
- Font licences: Rushford Printed, Military Scribe, Futura.
- Custom domain + `SITE_URL`.
- Later: backend for forms/newsletter, maybe a visual CMS for non-technical editing.
