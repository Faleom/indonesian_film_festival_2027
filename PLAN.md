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
- Beige crumpled-paper background (SVG lighting filter, no background text). No external images.
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
Create content collections with placeholder data: films, events, sponsors, faq, team, media.
Build components: Navbar, Footer, Hero (one big halftone image + DisplayTitle + color splash overlay), FilmCard (newspaper-clipping style), FAQ accordion, SponsorStrip, TeamGrid, VideoPlayer (placeholder-aware), Forms (UI only, TODO(backend), "coming soon" toast).
One main image per section, lots of negative space.
```

## Phase 4: Pages (static, no motion yet)
```
Build all pages: /, /sfc, /uts, /edu-screening, /main-screening, /films/[slug], /faq, /about, /sponsors.
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
- update films, FAQ, sponsors, team
- swap placeholders for real photos/videos (using PLACEHOLDERS.md + media.json)
- run the halftone pipeline on new photos
- change theme colors/fonts for a new edition
- deploy changes
```

---

# Part 2: Pleno 1 update (Oct 2026)

Source: `docs/IFF 21 Pleno 1.pdf`. What changes:
- Real 21st edition theme: **Temaram: The Unwavering Glow of Indonesian Cinema** (+ its blurb).
- Real dates for every event, and a **new fifth event: Film Exhibition** (27–28 Feb 2027).
- Vision & mission for the About page.
- Finance & Booth fundraisers go into a public **"Support us"** section.
- More motion: every event page gets its own animated hero.

Out of scope (internal, not for the public site): each division's phase timeline (Foundation,
job delegation, MoU and so on), sponsorship/vendor email outreach, the slides' childhood photos,
and team names (wait until every division sends name + role).

New journey order (by date): **SFC → Film Exhibition → Under the Stars → Educational Screening → Main Screening**.

### Content from the PDF

| Event | Dates (2027) | Public summary (from the slides) |
|---|---|---|
| Short Film Competition | Submissions open 2 Nov 2026, close 8 Feb; winners announced 27 Feb (after the seminar) | Annual student filmmaking contest, open globally; short films on a set topic |
| Film Exhibition (NEW) | 27 & 28 Feb | Curated exhibition bringing Indonesian cinema to life: iconic films, props, costumes, memorabilia, behind-the-scenes stories; shows the SFC Grand Winner and archival film material |
| Under the Stars | 20 Mar | Outdoor screening with live performances, food stalls and cultural activities |
| Educational Screening | 19 & 20 Apr | School program at ACMI: Indonesian films, cultural performances, interactive workshops |
| Main Screening | 14, 15 & 16 May | Grand premiere: three days of "nobar" Indonesian films with a special talk show and artist showcase |

Fundraisers ("Support us"):

| Item | Dates |
|---|---|
| Food PO 1: nasi kuning + java tea | PO 10–15 Oct 2026, pickup 16–17 Oct |
| Exam Pack: brookie + exam essentials | PO 18–23 Oct, sent 24 Oct |
| Raffle | PO 5–14 Dec, winners announced 16 Dec |
| Valentine's hampers | PO 4–10 Feb 2027, pickup 13 Feb |
| Booth at Under the Stars | 20 Mar |
| Food PO 2 | PO 16–23 Apr, pickup 24–25 Apr |

**Decisions (confirmed by the user, 6 Oct 2026):**
1. Year is **2027** (the per-event slides saying 2026 are a typo).
2. Pickup dates conflict in the slides; use the detail slides for now (Food PO 1 pickup 16–17 Oct, Food PO 2 pickup 24–25 Apr). Easy to change in support.json.
3. Exhibition venue/times: **TBC** until closer to the date.
4. Fundraiser order links: **TBC** (`#`).
5. SFC public date: show the submission window; 27 Feb winner announcement as a key date.

### Film Exhibition palette (proposed: "archive green")
Picks up where the other inks leave off and doesn't clash with the gold `beige` accent. Checked on offwhite `#EAE4D8`:

| token | value | contrast |
|---|---|---|
| primary | `#0E7C66` | 4.05:1 (display/large only) |
| dark | `#0B5345` | 7.10:1 (small accent text) |
| light | `#9FD3C4` | decorative only |
| on-primary | `#FFFFFF` | 5.13:1 |

## Phase 11: Pleno 1 content
```
Update src/content from docs/IFF 21 Pleno 1.pdf (see the table above):
- site.json: theme "Temaram", themeSubtitle = the Grand Theme blurb, dates "Feb–May 2027".
- events.json: real dates/dateLabels/summaries for the 4 events; new order 1–5 by date.
- pages.json: About gets vision + mission (3 bullet points).
- New src/content/support.json: fundraisers (name, blurb, PO open/close, pickup, orderUrl "#", media key).
- FAQ: fix any answers that contradict the new dates.
- Update CLAUDE.md (four events -> five, journey order, Exhibition theme), HANDOVER.md and PROJECT-LOG.md.
No component changes yet.
```

## Phase 12: Film Exhibition, the fifth event
```
Wire up a new event `exhibition` (slug /exhibition, theme `exh`) everywhere the four events are hardcoded:
- themes.css: [data-theme='exh'] with the archive-green palette + AA tokens; motion.css registered colours.
- content.config.ts enums, lib/content.ts + lib/media.ts types (EventId, Theme), scripts/halftone.mjs theme list.
- src/pages/exhibition.astro via EventPage (no film lineup, so it must render cleanly with 0 films;
  show "Featuring the SFC Grand Winner" instead).
- media.json keys: hero-exhibition, broll-exhibition, still-exhibition-1..3; PLACEHOLDERS.md.
- Navbar (site.json nav), footer, JourneyStrip, HomeHero swatches, /styleguide (5th theme column).
- Film strip: 5 events. Check the HUD segments, title cards ("Event 02 / 05") and the frame count
  still hold 60 fps; re-ink still happens on the stage only, never <body>.
Check 375/768/1440 and AA contrast for the new theme.
```

## Phase 13: Support us + Temaram
```
- SupportSection component reading support.json: newspaper "classified ads" cards (each one a clipping with
  date stamps, "PRE-ORDER OPEN / CLOSED / SOON" status computed at build from the dates, order button).
  On the home page above the sponsors; also on /sponsors.
- Home "Temaram" section: the real theme title with the script-word treatment and the blurb.
- About: vision & mission block.
No invented details: anything missing stays TBC.
```

## Phase 14: Scroll-driven 3D hero on every event page (DONE 6 Oct 2026)
```
First attempt (SVG/CSS layers on the shared hero layout) was rejected: too uniform, weaker than home.
Final: each event page pins its hero and plays its own 3D scene as you scroll, printed through the
halftone pass (scripts/three/eventScene.ts + scripts/three/events/*, picked by events.json `heroScene`):
- sfc         clapper   clapperboard swings in and SNAPs shut, camera dives down a spiral of film frames
- exhibition  gallery   lights stutter on, walk the gallery past framed works and exhibits to the big frame
- uts         open-air  ink night sky with paper stars, tilt down over the crowd to the glowing screen
- edu         book      a giant reader opens, pages curl and turn, camera dives onto the page
- main        theatre   curtains sway then open, bulbs chase, fly over the seats to the screen
Overlay beats (tagline, summary, final title) read --p; tickets stay in a bottom bar.
Rule changed: max one heavy 3D scene per page (home has two). Static Hero for no-JS / reduced motion / no WebGL.
```

## Phase 15: More motion across the site + audit (DONE 6 Oct 2026)
```
- Home: Temaram section "glow": text sits in dim dots and a soft lamp (pointer/scroll) brightens them.
- Support us cards: tape/stamp reveals, status stamp thuds on scroll.
- Event pages below the hero: info/date block "prints" plate by plate; key dates draw in as a mini timeline.
- About: vision/mission typed on, mission bullets fold in.
- Ink-wipe transition between major sections where it fits.
Then the perf pass: 60 fps target, no layout reads per frame, Lighthouse 90+ mobile, reduced motion kill switch.
Ask for checks on an iPhone (Safari) and Galaxy A56.
```

Each phase: dev server + /styleguide check. **Do not push to GitHub until the user says "push".**

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
- Contact form submissions, newsletter, possibly a CMS so committee members can edit without Git.
