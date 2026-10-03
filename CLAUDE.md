# CLAUDE.md — 21st Indonesian Film Festival (IFF) Website

## Project context
- Website for the **21st Indonesian Film Festival (IFF)**, Melbourne. A non-profit, student-run festival, usually held at ACMI.
- Previous edition (20th, 2026): "Arunika: The Ascending Light of Cinema". 21st edition theme TBD; use a placeholder.
- Events: there are exactly four, no others (reference: https://www.indonesianfilmfestivalau.com):
  - `sfc`: Short Film Competition (theme `sfc`)
  - `uts`: **Under the Stars**, an open-air community screening (theme `uts`). UTS is NOT a university.
  - `edu`: Educational Screening, for students and young audiences (theme `base` until it gets its own palette)
  - `main`: Main Screening, three curated films plus panels and Q&A (theme `main`)
  - `base` theme: general festival brand (home, about, etc.)
- Festival journey order: **SFC → Under the Stars → Educational Screening → Main Screening**. Colour gradient: SFC → UTS → Main.

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
- Same **beige newspaper background** everywhere: paper texture plus faint, low-opacity newspaper column text behind the content.
- Signature title treatment (from the FAQ prototype): a huge display title, with a script word overlapping it at an angle in beige/gold (e.g. "Frequently *Asked* Questions"). The image fades into the event color at the bottom edge.

### Color palettes (CSS variables, switched via `data-theme` on `<body>`)
| theme | primary | dark | light | offwhite | black | beige |
|---|---|---|---|---|---|---|
| main | #D80D1E | #7B000B | #E47D86 | #EAE4D8 | #000000 | #E1C892 |
| uts  | #FA26B2 | #DB41A6 | #FFBEE5 | #EAE4D8 | #000000 | #E1C892 |
| sfc  | #004BB6 | #273E60 | #9DBED8 | #EAE4D8 | #000000 | #E1C892 |
| base | #7200B8 | #632E89 | #C59DD8 | #EAE4D8 | #000000 | #E1C892 |

### Typography
| role | font | fallback |
|---|---|---|
| Display / big titles | Rushford Printed | Bebas Neue, Oswald, sans-serif |
| Script accent | Military Script | cursive |
| Condensed headings | Etna Condensed | Oswald, sans-serif |
| Typewriter / kicker / schedule | Special Elite (Google Fonts) | monospace |
| Body | Futura | Jost (Google Fonts), sans-serif |

Font files go in `/public/fonts`. Rushford, Military Script, Etna, and Futura need a valid web license before launch.

## Motion direction
- Rich, **site-wide** motion. Not just the hero: every page and section gets some.
- Select 3D, always in the **risograph/newspaper language**: halftone dots, ink misregistration, paper folds, grain, film strips, typewriter. **No glossy or realistic 3D.**
- 3D renders through a **custom halftone post-processing shader** (monochrome dots in the theme color, slight misregistration offset, paper grain).
- Reusable reveal system via data attributes, so content can opt in without new code:
  `data-reveal="misregister | typewriter | fold | halftone-grow | fade-up"`

### Motion rules (non-negotiable)
- Heavy 3D only in **max 3 hero spots**. Everything else uses GSAP + SVG/CSS.
- **Mobile** gets lighter fallbacks (e.g. a static or looped halftone image instead of a live 3D scene).
- Respect **`prefers-reduced-motion`**: there is a global kill switch that disables all motion.
- Content must render and be readable **without JS**.
- Target 60fps on mid-range phones. Lazy-load Three.js and dispose WebGL contexts on page leave.
- No animation may block reading, clicking, or buying tickets.

## Site structure
- `/`: home (base theme)
- `/sfc`, `/uts`, `/edu-screening`, `/main-screening`: event pages (own theme each)
- `/films/[slug]`: film detail
- `/faq`, `/about`, `/sponsors`
- No `/program` (schedule) or `/volunteer` pages. Don't invent sessions, schedules or event details that aren't in the content or on the official site.
- `/styleguide`: internal page showing all themes, fonts, components, and motion demos

## Content rules
- **Never hardcode content in components.** Films, events, sponsors, FAQ, team, and media all live in `src/content`.
- Film fields: title, year, director, synopsis, runtime, rating, poster (media key), trailer (media key), event, date, venue, ticketUrl.
- Next year's committee must be able to update the site by editing content files only (see `HANDOVER.md`).

## Quality bar
- Mobile-first, responsive at 375 / 768 / 1440.
- WCAG AA contrast in every theme. Check light-color text on beige especially carefully.
- Alt text on all images. Semantic HTML.
- Per-page meta + OG tags, sitemap, favicon.
- Lighthouse 90+ (performance, accessibility, SEO) on mobile.

## Working style
- Build in phases (see `PLAN.md`). Finish and verify one phase before starting the next.
- After each phase, run the dev server and check `/styleguide` and the affected pages.
- Keep components small and reusable. Prefer data attributes and config over one-off code.
