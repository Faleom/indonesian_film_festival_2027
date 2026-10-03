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
