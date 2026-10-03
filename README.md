# 21st Indonesian Film Festival — Website

Astro + Tailwind, static output. See `CLAUDE.md` for the design brief and `PLAN.md` for the build phases.

## Commands

| Command | What it does |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Process photos (halftone), then start the dev server at `localhost:4321` |
| `npm run build` | Process photos (halftone), then build the site into `dist/` |
| `npm run preview` | Serve the built `dist/` locally |
| `npm run halftone` | Process photos only. Add `-- --force` to redo every photo |
| `npm run placeholders` | Regenerate `PLACEHOLDERS.md` from `src/content/media.json` |
| `npm run render:3d-fallback` | Re-render the static 3D fallback image (site must be running, needs Chrome) |

The design system lives at `/styleguide`.

## Halftone image pipeline

Every photo on the site is printed as **halftone dots**, monochrome per event, on transparent paper so the beige background shows through, with the bottom edge fading out.

### Adding a photo

1. Find the photo's key in `PLACEHOLDERS.md` (e.g. `hero-sfc`).
2. Save the photo as `src/assets/raw/<key>.jpg` (jpg, png, webp, tif and avif all work). Use the original, full-size, colour photo. The pipeline does the rest.
3. Run `npm run dev` (or `npm run halftone`). The placeholder for that key is replaced automatically.

If the raw folder is empty, the pipeline skips and the placeholders stay. Deleting a raw photo also deletes its outputs.

### What it produces

For each photo, in `public/images/halftone/` (generated, not committed; it's rebuilt on every build):

| File | Use |
|---|---|
| `<key>-black.png` | Pure black dots |
| `<key>-sfc.png`, `-uts.png`, `-main.png`, `-base.png` | Dots in each theme's primary colour (read from `src/styles/themes.css`) |
| `<key>-<variant>-800.png` | Smaller copy of each for phones (`srcset`) |
| `manifest.json` | Sizes, paths and hashes; read by `<Media>`, and used to skip unchanged photos |

Steps: resize to `maxWidth` → greyscale → auto-levels → contrast → slight blur → dots on a rotated grid, dot area following darkness → dots shrink away across the bottom `fade` → saved as 16-colour PNG (about half the size of WebP for flat dot patterns).

### Settings: `halftone.config.json`

| Setting | Default | Meaning |
|---|---|---|
| `dotSize` | `8` | Grid spacing in pixels (at `maxWidth`). Bigger = chunkier, more "riso" |
| `angle` | `45` | Screen angle in degrees |
| `contrast` | `1.15` | Contrast boost before screening. Raise for flat or grey photos |
| `gamma` | `1.0` | 1.0–3.0. Higher brightens midtones (smaller dots) |
| `fade` | `0.28` | Fraction of the height at the bottom where dots shrink away. `0` = off |
| `maxWidth` | `1600` | Output width cap (smaller images aren't enlarged) |
| `smallWidths` | `[800]` | Extra widths for responsive `srcset` |
| `overrides` | | Per-photo settings, e.g. `"hero-home": { "dotSize": 10 }` |

Changing a setting re-processes the affected photos on the next run. Unchanged photos are skipped.

### Using it in a page

```astro
<Media id="hero-sfc" />                 <!-- dots follow the page's data-theme -->
<Media id="hero-sfc" tone="black" />    <!-- pre-rendered black -->
<Media id="hero-sfc" tone="main" />     <!-- pre-rendered in Main Screening red -->
<Media id="hero-sfc" priority sizes="50vw" />
```

- `tone="theme"` (default) uses the black file as a CSS mask over the current theme's primary, so one image works under any `data-theme`.
- Set a default per image with `"tone"` in `media.json`.
- Set `"halftone": false` on an image in `media.json` to show the original file from `/public` untouched (logos, sponsor artwork).

`<Media>` picks, in order: halftone output → original file at `src` in `/public` → labelled placeholder.

## Halftone 3D

`<HalftoneCamera />` (`src/components/three/`) renders a 3D model through a halftone shader (`src/scripts/three/`): dots in the theme's primary colour, a slightly misregistered key plate in the theme's dark colour, and grain. It turns towards the mouse; scrolling turns it and enlarges the dots near the screen edges.

- Three.js is lazy-loaded only when the block is near the viewport, and only on desktop (fine pointer, 768px+) with motion on.
- Phones, reduced motion and no-JS show the static fallback `public/images/camera-fallback.png`, recoloured per theme with a CSS mask. It's also shown until the live scene is ready.
- Each scene renders only while visible, and its WebGL context is released when you leave the page.
- Use `live={false}` for extra copies that should only ever show the static image. Heavy 3D is limited to 3 hero spots site-wide.

**Replacing the model:** save a GLB as `public/models/camera.glb`; it's picked up automatically and scaled to fit. Then run the site and `npm run render:3d-fallback` to refresh the fallback image.

### Home page 3D (Phase 7)

Two pinned, scroll-driven scenes on the home page (desktop with motion on; phones and reduced motion get the static layouts):

- **Hero** (`src/components/home/HomeHero.astro`, `src/scripts/three/heroScene.ts`): the film camera made of halftone dots turns, explodes and reassembles into the festival title. The title text comes from `pages.json` (`home.title` + `home.script`), drawn in the site fonts.
- **Journey film strip** (`src/components/home/FilmStripJourney.astro`, `src/scripts/three/filmStrip.ts`): a curved 3D film strip with, per event, a title card, its b-roll (`broll-<event>` in `media.json`) and up to two film posters. The site re-inks in each event's colours as its frames pass the centre.

**Adding b-roll:** save a short silent loop as `public/videos/broll-sfc.mp4` (and `-uts`, `-edu`, `-main`). Posters and photos come through the halftone pipeline, which also writes the greyscale `-tex.jpg` the strip uses as a texture.

### Site-wide motion (Phase 8)

Built into the shared components, so new pages get it for free. All of it is off with reduced motion, the footer toggle, or without JS.

- **Reveals:** DisplayTitle misregisters into place, SectionHead kickers type out, BodyText fades up, hero images print in as growing dots, card grids fold in one by one, video frames unfold. Turn one off with `reveal={false}` (DisplayTitle, BodyText).
- **Halftone placeholders** change dot size as they scroll; real halftone images drift in scale.
- **Film clippings** tilt toward the pointer (desktop).
- **FAQ** answers unfold like folded paper.
- **Sponsors (home):** a marquee whose speed follows your scrolling (`<SponsorStrip variant="marquee" />`).
- **Team (about):** a draggable paper stack with Back/Next buttons.
- **Event pages** re-print in their colour on a direct visit (`<BaseLayout reprint>`).

Effects live in `src/scripts/motion/effects.ts`.

## Deploying (Vercel)

The site is fully static; Vercel builds it with the settings in `vercel.json` (no adapter needed).

1. In Vercel, **Add New → Project** and import `Faleom/indonesian_film_festival_2027`. The Astro preset, `npm run build` and `dist` are picked up from `vercel.json`.
2. Node 22 is required (`engines` in `package.json`; Vercel's default is fine).
3. Optional: once the domain is decided, add an environment variable **`SITE_URL`** (e.g. `https://example.com.au`) and redeploy. It's used for canonical links, social share tags, `robots.txt` and the sitemap. Until then the Vercel production URL is used automatically.
4. Every push to `main` deploys to production; other branches get preview URLs.

The build runs the halftone pipeline and favicon generator first (`prebuild`), so generated images and icons are never committed.

**Fonts:** `public/fonts` holds subset `.woff2` copies; the originals are in `src/assets/fonts-src`. Regenerate after replacing a font:

```sh
# Rushford: capitals, digits, punctuation only (all display text is uppercase)
python3 -m fontTools.subset src/assets/fonts-src/RushfordPrinted.otf --unicodes="U+0020-0040,U+0041-005A,U+005B-0060,U+007B-007E,U+00A0,U+00B7,U+2013-2014,U+2018-201D,U+2022,U+2026,U+2190-2193" --layout-features='*' --flavor=woff2 --output-file=public/fonts/RushfordPrinted.woff2
# Military Scribe: basic Latin
python3 -m fontTools.subset src/assets/fonts-src/MilitaryScribe.ttf --unicodes="U+0020-007E,U+00A0,U+2018-201D,U+2026" --layout-features='*' --flavor=woff2 --output-file=public/fonts/MilitaryScribe.woff2
```

**Logo / favicon:** save the logo as `src/assets/brand/logo.svg` (or `.png`); icons are generated on the next build. Until then a neutral dot icon is used.

**Performance note:** Lighthouse scores 98–99 on desktop and ~80 on throttled mobile. The mobile gap is the Rushford font file (~350 KB even after subsetting); everything else scores 100.
