# Placeholders

Every image and video on the site is defined once in `src/content/media.json`.
Until the real file exists, `<Media id="key" />` renders a halftone placeholder labelled `[IMG: key ratio]` or `[VIDEO: key ratio]`.

**To swap in a real photo (halftone look):** save it as `src/assets/raw/<key>.jpg` (any of jpg/png/webp/tif/avif). The halftone pipeline turns it into dots in the theme colour on the next `npm run dev` / `npm run build` (or run `npm run halftone`).

**To use a file as-is (videos, logos, untreated photos):** save it at the file path below (inside `/public`). For images, also set `"halftone": false` for that key in `media.json`.

Then run `npm run placeholders` to refresh this list. To use a different filename, change `src` for that key in `media.json`.

_54 of 54 still pending. Generated from media.json; don't edit by hand._

| Key | Type | Location | Ratio | Recommended size | File path (as-is) | Status |
|---|---|---|---|---|---|---|
| `hero-home` | image | / (home) hero | 16:9 | 2400x1350 | `public/images/hero-home.jpg` | ⬜ placeholder |
| `hero-loop` | video | / (home) hero, mobile fallback for 3D | 9:16 | 1080x1920, under 4 MB, muted loop | `public/videos/hero-loop.mp4` | ⬜ placeholder |
| `hero-bg-video` | video | / (home) hero, full-screen backdrop behind the 3D camera (printed as halftone dots) | 16:9 | 1920x1080 H.264, 10-20 s silent loop, under 8 MB; keep the subject centred (phones crop the sides) | `public/videos/hero-bg.mp4` | ⬜ placeholder |
| `hero-side-video` | video | / (home) hero, left of the 3D camera (desktop) | 4:5 | 1080x1350, 6-10 s silent loop, under 4 MB | `public/videos/hero-side.mp4` | ⬜ placeholder |
| `hero-side-photo` | image | / (home) hero, right of the 3D camera (desktop) | 4:5 | 1600x2000 | `public/images/hero-side.jpg` | ⬜ placeholder |
| `hero-sfc` | image | /sfc hero | 4:5 | 1600x2000 | `public/images/hero-sfc.jpg` | ⬜ placeholder |
| `hero-uts` | image | /uts hero | 4:5 | 1600x2000 | `public/images/hero-uts.jpg` | ⬜ placeholder |
| `hero-edu-screening` | image | /edu-screening hero | 4:5 | 1600x2000 | `public/images/hero-edu-screening.jpg` | ⬜ placeholder |
| `hero-exhibition` | image | /exhibition hero | 4:5 | 1600x2000 | `public/images/hero-exhibition.jpg` | ⬜ placeholder |
| `hero-main-screening` | image | /main-screening hero | 4:5 | 1600x2000 | `public/images/hero-main-screening.jpg` | ⬜ placeholder |
| `trailer-main` | video | / (home) and /main-screening trailer | 16:9 | 1920x1080 H.264, under 25 MB | `public/videos/trailer-main.mp4` | ⬜ placeholder |
| `trailer-sfc` | video | /sfc trailer | 16:9 | 1920x1080 H.264, under 25 MB | `public/videos/trailer-sfc.mp4` | ⬜ placeholder |
| `faq-hero` | image | /faq hero | 4:5 | 1600x2000 | `public/images/faq-hero.jpg` | ⬜ placeholder |
| `about-hero` | image | /about hero | 3:2 | 2100x1400 | `public/images/about-hero.jpg` | ⬜ placeholder |
| `sponsors-hero` | image | /sponsors header | 3:2 | 2100x1400 | `public/images/sponsors-hero.jpg` | ⬜ placeholder |
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
| `broll-sfc` | video | Home: 3D film strip (journey) | 16:9 | 1280x720 H.264, 8-15 s silent loop, under 6 MB | `public/videos/broll-sfc.mp4` | ⬜ placeholder |
| `broll-uts` | video | Home: 3D film strip (journey) | 16:9 | 1280x720 H.264, 8-15 s silent loop, under 6 MB | `public/videos/broll-uts.mp4` | ⬜ placeholder |
| `broll-edu` | video | Home: 3D film strip (journey) | 16:9 | 1280x720 H.264, 8-15 s silent loop, under 6 MB | `public/videos/broll-edu.mp4` | ⬜ placeholder |
| `broll-exhibition` | video | Home: 3D film strip (journey) | 16:9 | 1280x720 H.264, 8-15 s silent loop, under 6 MB | `public/videos/broll-exhibition.mp4` | ⬜ placeholder |
| `broll-main` | video | Home: 3D film strip (journey) | 16:9 | 1280x720 H.264, 8-15 s silent loop, under 6 MB | `public/videos/broll-main.mp4` | ⬜ placeholder |
| `still-sfc-1` | image | Home: 3D film strip (journey) | 4:3 | 1600x1200 (landscape photo) | `public/images/stills/sfc-1.jpg` | ⬜ placeholder |
| `still-sfc-2` | image | Home: 3D film strip (journey) | 4:3 | 1600x1200 (landscape photo) | `public/images/stills/sfc-2.jpg` | ⬜ placeholder |
| `still-sfc-3` | image | Home: 3D film strip (journey) | 4:3 | 1600x1200 (landscape photo) | `public/images/stills/sfc-3.jpg` | ⬜ placeholder |
| `still-uts-1` | image | Home: 3D film strip (journey) | 4:3 | 1600x1200 (landscape photo) | `public/images/stills/uts-1.jpg` | ⬜ placeholder |
| `still-uts-2` | image | Home: 3D film strip (journey) | 4:3 | 1600x1200 (landscape photo) | `public/images/stills/uts-2.jpg` | ⬜ placeholder |
| `still-uts-3` | image | Home: 3D film strip (journey) | 4:3 | 1600x1200 (landscape photo) | `public/images/stills/uts-3.jpg` | ⬜ placeholder |
| `still-edu-1` | image | Home: 3D film strip (journey) | 4:3 | 1600x1200 (landscape photo) | `public/images/stills/edu-1.jpg` | ⬜ placeholder |
| `still-edu-2` | image | Home: 3D film strip (journey) | 4:3 | 1600x1200 (landscape photo) | `public/images/stills/edu-2.jpg` | ⬜ placeholder |
| `still-edu-3` | image | Home: 3D film strip (journey) | 4:3 | 1600x1200 (landscape photo) | `public/images/stills/edu-3.jpg` | ⬜ placeholder |
| `still-exhibition-1` | image | Home: 3D film strip (journey) | 4:3 | 1600x1200 (landscape photo) | `public/images/stills/exhibition-1.jpg` | ⬜ placeholder |
| `still-exhibition-2` | image | Home: 3D film strip (journey) | 4:3 | 1600x1200 (landscape photo) | `public/images/stills/exhibition-2.jpg` | ⬜ placeholder |
| `still-exhibition-3` | image | Home: 3D film strip (journey) | 4:3 | 1600x1200 (landscape photo) | `public/images/stills/exhibition-3.jpg` | ⬜ placeholder |
| `still-main-1` | image | Home: 3D film strip (journey) | 4:3 | 1600x1200 (landscape photo) | `public/images/stills/main-1.jpg` | ⬜ placeholder |
| `still-main-2` | image | Home: 3D film strip (journey) | 4:3 | 1600x1200 (landscape photo) | `public/images/stills/main-2.jpg` | ⬜ placeholder |
| `still-main-3` | image | Home: 3D film strip (journey) | 4:3 | 1600x1200 (landscape photo) | `public/images/stills/main-3.jpg` | ⬜ placeholder |
| `support-food-po-1` | image | "Support us" card (home + /sponsors) | 4:3 | 1200x900 | `public/images/support/food-po-1.jpg` | ⬜ placeholder |
| `support-exam-pack` | image | "Support us" card (home + /sponsors) | 4:3 | 1200x900 | `public/images/support/exam-pack.jpg` | ⬜ placeholder |
| `support-raffle` | image | "Support us" card (home + /sponsors) | 4:3 | 1200x900 | `public/images/support/raffle.jpg` | ⬜ placeholder |
| `support-valentines-hampers` | image | "Support us" card (home + /sponsors) | 4:3 | 1200x900 | `public/images/support/valentines-hampers.jpg` | ⬜ placeholder |
| `support-uts-booth` | image | "Support us" card (home + /sponsors) | 4:3 | 1200x900 | `public/images/support/uts-booth.jpg` | ⬜ placeholder |
| `support-food-po-2` | image | "Support us" card (home + /sponsors) | 4:3 | 1200x900 | `public/images/support/food-po-2.jpg` | ⬜ placeholder |

## Other placeholders

| Item | Location | Notes |
|---|---|---|
| Team photos | /about | One per person, no setup: save as `src/assets/raw/team-<id>.jpg` (id from `src/content/team.json`). People without a photo show an initials badge. Recommended 800x1000 portrait |
| 3D camera model | `<HalftoneCamera />` (styleguide now, home hero in Phase 7) | Procedural low-poly camera until `public/models/camera.glb` is provided. After adding it, run `npm run render:3d-fallback` with the site running to refresh the static fallback (`public/images/camera-fallback.png`) |
| Fonts | `public/fonts` | See `src/content/fonts.json` for exact filenames. Missing files fall back to Oswald / Jost / cursive |
