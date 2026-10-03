# Placeholders

Every image and video on the site is defined once in `src/content/media.json`.
Until the real file exists, `<Media id="key" />` renders a halftone placeholder labelled `[IMG: key ratio]` or `[VIDEO: key ratio]`.

**To swap in a real photo (halftone look):** save it as `src/assets/raw/<key>.jpg` (any of jpg/png/webp/tif/avif). The halftone pipeline turns it into dots in the theme colour on the next `npm run dev` / `npm run build` (or run `npm run halftone`).

**To use a file as-is (videos, logos, untreated photos):** save it at the file path below (inside `/public`). For images, also set `"halftone": false` for that key in `media.json`.

Then run `npm run placeholders` to refresh this list. To use a different filename, change `src` for that key in `media.json`.

_34 of 34 still pending. Generated from media.json; don't edit by hand._

| Key | Type | Location | Ratio | Recommended size | File path (as-is) | Status |
|---|---|---|---|---|---|---|
| `hero-home` | image | / (home) hero | 16:9 | 2400x1350 | `public/images/hero-home.jpg` | ⬜ placeholder |
| `hero-loop` | video | / (home) hero, mobile fallback for 3D | 9:16 | 1080x1920, under 4 MB, muted loop | `public/videos/hero-loop.mp4` | ⬜ placeholder |
| `hero-sfc` | image | /sfc hero | 4:5 | 1600x2000 | `public/images/hero-sfc.jpg` | ⬜ placeholder |
| `hero-uts` | image | /uts hero | 4:5 | 1600x2000 | `public/images/hero-uts.jpg` | ⬜ placeholder |
| `hero-edu-screening` | image | /edu-screening hero | 4:5 | 1600x2000 | `public/images/hero-edu-screening.jpg` | ⬜ placeholder |
| `hero-main-screening` | image | /main-screening hero | 4:5 | 1600x2000 | `public/images/hero-main-screening.jpg` | ⬜ placeholder |
| `trailer-main` | video | / (home) and /main-screening trailer | 16:9 | 1920x1080 H.264, under 25 MB | `public/videos/trailer-main.mp4` | ⬜ placeholder |
| `trailer-sfc` | video | /sfc trailer | 16:9 | 1920x1080 H.264, under 25 MB | `public/videos/trailer-sfc.mp4` | ⬜ placeholder |
| `faq-hero` | image | /faq hero | 4:5 | 1600x2000 | `public/images/faq-hero.jpg` | ⬜ placeholder |
| `about-hero` | image | /about hero | 3:2 | 2100x1400 | `public/images/about-hero.jpg` | ⬜ placeholder |
| `program-hero` | image | /program header | 21:9 | 2520x1080 | `public/images/program-hero.jpg` | ⬜ placeholder |
| `sponsors-hero` | image | /sponsors header | 3:2 | 2100x1400 | `public/images/sponsors-hero.jpg` | ⬜ placeholder |
| `volunteer-hero` | image | /volunteer hero | 4:5 | 1600x2000 | `public/images/volunteer-hero.jpg` | ⬜ placeholder |
| `og-default` | image | Social share image (meta og:image) | 1200:630 | 1200x630 | `public/images/og-default.jpg` | ⬜ placeholder |
| `poster-garam-dan-gula` | image | Film card + /films/garam-dan-gula | 2:3 | 1000x1500 | `public/images/posters/garam-dan-gula.jpg` | ⬜ placeholder |
| `poster-ombak-terakhir` | image | Film card + /films/ombak-terakhir | 2:3 | 1000x1500 | `public/images/posters/ombak-terakhir.jpg` | ⬜ placeholder |
| `poster-surat-untuk-ibu` | image | Film card + /films/surat-untuk-ibu | 2:3 | 1000x1500 | `public/images/posters/surat-untuk-ibu.jpg` | ⬜ placeholder |
| `poster-tukang-cukur` | image | Film card + /films/tukang-cukur | 2:3 | 1000x1500 | `public/images/posters/tukang-cukur.jpg` | ⬜ placeholder |
| `poster-benang-merah` | image | Film card + /films/benang-merah | 2:3 | 1000x1500 | `public/images/posters/benang-merah.jpg` | ⬜ placeholder |
| `poster-rumah-di-ujung-jalan` | image | Film card + /films/rumah-di-ujung-jalan | 2:3 | 1000x1500 | `public/images/posters/rumah-di-ujung-jalan.jpg` | ⬜ placeholder |
| `poster-senandika` | image | Film card + /films/senandika | 2:3 | 1000x1500 | `public/images/posters/senandika.jpg` | ⬜ placeholder |
| `trailer-senandika` | video | /films/senandika | 16:9 | 1920x1080 H.264, under 25 MB | `public/videos/trailer-senandika.mp4` | ⬜ placeholder |
| `poster-musim-kemarau` | image | Film card + /films/musim-kemarau | 2:3 | 1000x1500 | `public/images/posters/musim-kemarau.jpg` | ⬜ placeholder |
| `poster-pasar-malam` | image | Film card + /films/pasar-malam | 2:3 | 1000x1500 | `public/images/posters/pasar-malam.jpg` | ⬜ placeholder |
| `trailer-pasar-malam` | video | /films/pasar-malam | 16:9 | 1920x1080 H.264, under 25 MB | `public/videos/trailer-pasar-malam.mp4` | ⬜ placeholder |
| `poster-kabut-di-dieng` | image | Film card + /films/kabut-di-dieng | 2:3 | 1000x1500 | `public/images/posters/kabut-di-dieng.jpg` | ⬜ placeholder |
| `team-festival-director` | image | /about team grid | 4:5 | 800x1000 | `public/images/team/festival-director.jpg` | ⬜ placeholder |
| `team-deputy-director` | image | /about team grid | 4:5 | 800x1000 | `public/images/team/deputy-director.jpg` | ⬜ placeholder |
| `team-programming-lead` | image | /about team grid | 4:5 | 800x1000 | `public/images/team/programming-lead.jpg` | ⬜ placeholder |
| `team-events-lead` | image | /about team grid | 4:5 | 800x1000 | `public/images/team/events-lead.jpg` | ⬜ placeholder |
| `team-marketing-lead` | image | /about team grid | 4:5 | 800x1000 | `public/images/team/marketing-lead.jpg` | ⬜ placeholder |
| `team-design-lead` | image | /about team grid | 4:5 | 800x1000 | `public/images/team/design-lead.jpg` | ⬜ placeholder |
| `team-sponsorship-lead` | image | /about team grid | 4:5 | 800x1000 | `public/images/team/sponsorship-lead.jpg` | ⬜ placeholder |
| `team-treasurer` | image | /about team grid | 4:5 | 800x1000 | `public/images/team/treasurer.jpg` | ⬜ placeholder |

## Other placeholders

| Item | Location | Notes |
|---|---|---|
| 3D camera model | `<HalftoneCamera />` (styleguide now, home hero in Phase 7) | Procedural low-poly camera until `public/models/camera.glb` is provided. After adding it, run `npm run render:3d-fallback` with the site running to refresh the static fallback (`public/images/camera-fallback.png`) |
| Fonts | `public/fonts` | See `src/content/fonts.json` for exact filenames. Missing files fall back to Bebas Neue / Oswald / Jost / cursive |
