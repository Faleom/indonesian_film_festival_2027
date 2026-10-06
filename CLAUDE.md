# CLAUDE.md — 21st Indonesian Film Festival (IFF) Website

## Project context
- Website for the **21st Indonesian Film Festival (IFF)**, Melbourne. A non-profit, student-run festival, usually held at ACMI.
- Previous edition (20th, 2026): "Arunika: The Ascending Light of Cinema". 21st edition theme: **"Temaram: The Unwavering Glow of Indonesian Cinema"** (source: `docs/IFF 21 Pleno 1.pdf`).
- Events: there are exactly five, no others (source: Pleno 1 PDF; older reference: https://www.indonesianfilmfestivalau.com):
  - `sfc`: Short Film Competition, submissions 2 Nov 2026 to 8 Feb 2027, winners 27 Feb (theme `sfc`)
  - `exhibition`: **Film Exhibition** (NEW in the 21st), 27–28 Feb 2027, shows the SFC Grand Winner and archival film material (theme `exh`)
  - `uts`: **Under the Stars**, open-air screening + cultural festival, 20 Mar 2027 (theme `uts`). UTS is NOT a university.
  - `edu`: Educational Screening, school program at ACMI, 19–20 Apr 2027 (theme `base` until it gets its own palette)
  - `main`: Main Screening, grand premiere, 14–16 May 2027 (theme `main`)
  - `base` theme: general festival brand (home, about, etc.)
- Festival journey order: **SFC → Film Exhibition → Under the Stars → Educational Screening → Main Screening**.

## Current scope: FRONTEND ONLY
- No backend, no database, no auth, no CMS, no payments.
- Tickets = external link (placeholder `#` or ACMI URL in content data).
- Forms (contact, newsletter): build the UI only. Submit does nothing yet; show a "coming soon" toast. Leave a clear `TODO(backend)` comment.
- All content comes from local files in `src/content` (JSON / Markdown).

## Placeholders (IMPORTANT)
Real photos/videos come later. Until then:
- Images: use generated placeholders. A beige box with a halftone pattern and a label like `[IMG: hero-main 16:9]`. Never hotlink random internet images.
- Videos: a placeholder block with a play icon and a label like `[VIDEO: trailer-main 16:9]`.
- 3D models: use a simple low-poly procedural shape (e.g. a box-based film camera or film reel built from primitives) until a real GLB is provided in `/public/models`.
- Fonts: if the `.woff2` files are missing from `/public/fonts`, fall back gracefully (see Typography).
- Every placeholder must be defined in **one place** (`src/content/media.json` or similar), mapping a key to its file path. That way swapping in the real asset only means dropping the file in and updating the path.
- Keep a list of every placeholder in `PLACEHOLDERS.md`: key, location, aspect ratio, and recommended size.

## Tech stack
- **Astro** + **Tailwind CSS**, static output
- **GSAP** + ScrollTrigger + SplitText (site-wide motion)
- **Lenis** (smooth scroll)
- **Three.js** as Astro islands (`client:visible`) for 3D
- **Astro View Transitions** (page transitions)
- **sharp** (build-time halftone image processing)
- Deploy target: **Vercel**

## Design concept
Source: `/docs/konsep_iff_21.pdf` (read it and the reference images in `/docs`).

- **Main idea:** risograph printing + retro newspaper.
- Simple assets. **One main image per section/design.** Lots of negative space.
- Images are **halftone**, **monochromatic per event**, with color overlay splashes, grain, and texture.
- Same **beige crumpled-paper background** everywhere (generated texture, no text in the background).
- Signature title treatment (from the FAQ prototype): a huge display title, with a script word overlapping it at an angle in beige/gold (e.g. "Frequently *Asked* Questions"). The image fades into the event color at the bottom edge.

### Color palettes (CSS variables, switched via `data-theme` on `<body>`)
| theme | primary | dark | light | offwhite | black | beige |
|---|---|---|---|---|---|---|
| main | #D80D1E | #7B000B | #E47D86 | #EAE4D8 | #000000 | #E1C892 |
| uts  | #FA26B2 | #DB41A6 | #FFBEE5 | #EAE4D8 | #000000 | #E1C892 |
| sfc  | #004BB6 | #273E60 | #9DBED8 | #EAE4D8 | #000000 | #E1C892 |
| base | #7200B8 | #632E89 | #C59DD8 | #EAE4D8 | #000000 | #E1C892 |
| exh  | #0E7C66 | #0B5345 | #9FD3C4 | #EAE4D8 | #000000 | #E1C892 |

`exh` ("archive green") isn't in the concept PDF; proposed for the Film Exhibition in Oct 2026, replace if the Creative team makes one.

### Typography
| role | font | fallback |
|---|---|---|
| Display / big titles | Rushford Printed | Oswald, sans-serif |
| Script accent | Military Script | cursive |
| Condensed headings | Oswald (Google Fonts; Etna Condensed dropped, it's paid) | Arial Narrow, sans-serif |
| Typewriter / kicker | Special Elite (Google Fonts, self-hosted) | monospace |
| Body | Futura | Jost (Google Fonts, self-hosted), sans-serif |

Font files go in `/public/fonts` (Latin-subset .woff2; originals in `src/assets/fonts-src`). Rushford, Military Script/Scribe and Futura need a valid web license before launch.

## Motion direction
- Rich, **site-wide** motion. Not just the hero: every page and section gets some.
- Select 3D, always in the **risograph/newspaper language**: halftone dots, ink misregistration, paper folds, grain, film strips, typewriter. **No glossy or realistic 3D.**
- 3D renders through a **custom halftone post-processing shader** (monochrome dots in the theme color, slight misregistration offset, paper grain).
- Reusable reveal system via data attributes, so content can opt in without new code:
  `data-reveal="misregister | typewriter | fold | halftone-grow | fade-up | print | draw"`

### Motion rules (non-negotiable)
- Heavy 3D: **max one scene per page** (home has two: hero + film strip). Each event page has its own scroll-driven 3D hero (`src/scripts/three/events/*`, picked by `heroScene` in events.json; changed Oct 2026 at the user's request). Everything else uses GSAP + SVG/CSS.
- **Mobile** runs lighter versions of the 3D (fewer particles, lower resolution, adaptive quality). Reduced motion and no-JS get the static fallbacks.
- Respect **`prefers-reduced-motion`**: there is a global kill switch that disables all motion.
- Content must render and be readable **without JS**.
- Target 60fps on mid-range phones. Lazy-load Three.js and dispose WebGL contexts on page leave.
- No animation may block reading, clicking, or buying tickets.

## Site structure
- `/`: home (base theme)
- `/sfc`, `/exhibition`, `/uts`, `/edu-screening`, `/main-screening`: event pages (own theme each, each with its own animated hero)
- `/films/[slug]`: film detail
- `/faq`, `/about`, `/sponsors`
- No `/program` (schedule) or `/volunteer` pages. Don't invent sessions, schedules or event details that aren't in the content or on the official site.
- `/styleguide`: internal page showing all themes, fonts, components, and motion demos

## Content rules
- **Never hardcode content in components.** Films, events, sponsors, FAQ, team, fundraisers (`support.json`) and media all live in `src/content`.
- Film fields: title, year, director, synopsis, runtime, rating, poster (media key), trailer (media key), event, date, venue, ticketUrl.
- Next year's committee must be able to update the site by editing content files only (see `HANDOVER.md`).

## Quality bar
- Mobile-first, responsive at 375 / 768 / 1440.
- WCAG AA contrast in every theme. Check light-color text on beige especially carefully.
- Alt text on all images. Semantic HTML.
- Per-page meta + OG tags, sitemap, favicon.
- Lighthouse 90+ (performance, accessibility, SEO) on mobile.

## Hard-won rules (from real-device testing, Oct 2026)
Full story in `docs/PROJECT-LOG.md`. Break these and iPhones/mid-range Androids suffer:
- No `overflow: clip/hidden` on any ancestor of a `position: sticky` element (home hero, film strip): iOS Safari shakes it while scrolling. Clip bleeding elements in a full-width `.bleed-clip` wrapper instead.
- Fixed full-screen layers use `height: 100lvh`, not `inset: 0` / `100vh` alone (Android leaves the bottom bare when the address bar hides). No `background-attachment: fixed`.
- Never re-theme `<body>` during scroll animations; the film strip re-inks only its own stage.
- 3D: render the scene behind the halftone at dot resolution, cap at 60 fps (`frameLoop` in `src/scripts/three/post.ts`), use time-based easing (`ease`), build heavy scenes behind the loader or when idle (never as they scroll in), and render/tick only while visible.
- Don't read layout every frame after writing styles; cache positions.
- Defaults: hero and film strip use the "solid" looks (`?hero=classic`, `?strip=classic` keep the old ones).
- After motion/3D/layout changes, ask the user to check on an iPhone (Safari) and a mid-range Android (Galaxy A56).

## Working style
- Build in phases (see `PLAN.md`). Finish and verify one phase before starting the next.
- After each phase, run the dev server and check `/styleguide` and the affected pages.
- Keep components small and reusable. Prefer data attributes and config over one-off code.
