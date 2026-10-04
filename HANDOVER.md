# Handover: IFF website

For next year's committee and webmaster. Most updates need **no coding**: you edit
text files in `src/content/`, drop photos and videos into folders, and push to GitHub.
The site rebuilds and goes live on its own.

- Live site: https://indonesian-film-festival-2027.vercel.app (until a custom domain is set)
- Code: https://github.com/Faleom/indonesian_film_festival_2027
- What was built, why, and what we learned: [`docs/PROJECT-LOG.md`](docs/PROJECT-LOG.md)
- Technical reference (commands, image pipeline, 3D): [`README.md`](README.md)
- Design brief and rules (also read by Claude Code): [`CLAUDE.md`](CLAUDE.md)

---

## 1. Before you launch: things that are still placeholders

| What | Where | Status |
|---|---|---|
| Films (titles, directors, synopses) | `src/content/films.json` | **Invented for layout.** Replace with the real lineup |
| Sponsors | `src/content/sponsors.json` | **Invented.** Replace |
| Committee / team | `src/content/team.json` | **"Name TBC".** Replace |
| Dates, venue, theme, ticket link, email, socials | `src/content/site.json`, `src/content/events.json` | Marked **TBC** or `#` |
| Photos and videos | `PLACEHOLDERS.md` lists every slot | Halftone placeholders until real files are added |
| 3D camera model | `public/models/camera.glb` | Built from boxes until a real model is added |
| Font licences | Rushford Printed, Military Scribe, Futura | **Need a web licence before launch** |

---

## 2. Everyday updates (no code)

All content lives in `src/content/`. Each file starts with a `$comment` explaining its fields.

| To change… | Edit |
|---|---|
| Festival name, edition, dates, venue, ticket link, email, socials, menu | `site.json` |
| The four events (names, dates, summaries, which media they show) | `events.json` |
| Films | `films.json` (`event` is `sfc`, `uts`, `edu` or `main`) |
| FAQ | `faq.json` |
| Sponsors | `sponsors.json` |
| Team (60+ people is fine) | `team.json` |
| Page titles and intro text | `pages.json` |
| Which photo/video goes where | `media.json` |

Rules that matter:
- **Only real information.** Don't add events, sessions or schedules that aren't confirmed.
  The four events are fixed: Short Film Competition → Under the Stars → Educational
  Screening → Main Screening. (Under the Stars is an open-air screening, not a university.)
- **Ticket links:** while `ticketUrl` is `"#"`, buttons show a "tickets aren't on sale yet"
  message. Put the real ACMI link in and they become normal links.
- **JSON is strict:** keep the quotes and commas. If the build fails after an edit, a missing
  comma is the usual cause. Paste the file into a JSON validator to find it.

---

## 3. Adding real photos and videos

1. Open `PLACEHOLDERS.md`. Every slot has a **key** (e.g. `hero-sfc`), the shape it needs
   (portrait / landscape) and a recommended size.
2. **Photos:** save the original full-size photo as `src/assets/raw/<key>.jpg`.
   It's turned into halftone dots in the event colour automatically.
3. **Videos:** save the file at the path in `media.json` (e.g. `public/videos/broll-sfc.mp4`).
   Short, silent, steady loops work best. Keep them small (sizes are in `PLACEHOLDERS.md`).
4. Run `npm run placeholders` to refresh the list, then push.

What makes a good photo here: one clear subject, strong contrast, no small text. Busy or
dark photos turn into mush as dots. Use original files, not screenshots or Instagram downloads.

**Logo:** `src/assets/brand/logo.png` (white on transparent works; it's printed black where
needed). The browser-tab icons and the header logo are generated from it on every build.

**3D camera model:** save a GLB as `public/models/camera.glb`. Plain materials, clear
light/dark contrast between parts, facing +x. Then run the site and
`npm run render:3d-fallback` to refresh the static image phones and reduced-motion get.

---

## 4. Publishing

Every push to the `main` branch on GitHub deploys to Vercel automatically (about 1 minute).

**If the site doesn't update after a push:** open the Vercel dashboard → the project →
**Deployments**. If there's no new deployment, click **⋯** on the latest one → **Redeploy**.
(This happened once: GitHub didn't notify Vercel about one push.)

**If you still see the old icon or styles:** that's your browser cache. Hard refresh, or try
a private/incognito window.

**Custom domain:** add it in Vercel, then set the environment variable `SITE_URL`
(e.g. `https://indonesianfilmfestival.com.au`) and redeploy, so share links and the sitemap
use it.

---

## 5. A new edition (22nd and onwards)

- `site.json`: `edition`, `editionNumber`, `year`, `theme`, `dates`, `previousEdition`.
- New colours: `src/styles/themes.css` (one block per theme), plus the same hex values in
  `src/styles/motion.css` (`@property` initial values) and `src/layouts/BaseLayout.astro`
  (`themeColour`, the phone browser bar colour). Check text contrast (WCAG AA) on the beige paper.
- Fonts: `src/content/fonts.json` and the files in `public/fonts` (see `README.md`).
- Replace films, sponsors, team, photos. Keep the rules in section 2.
- Update `CLAUDE.md` with the new theme, so Claude Code starts with the right brief.

---

## 6. Before every launch: test on real phones

The 3D and motion behave differently per device, and some bugs only show on real hardware
(see the log). After any change to motion, the hero or the film strip, check:

- **An iPhone in Safari** (scroll the hero and the film strip, finger down and flicking).
- **A mid-range Android in Chrome** (we used a Galaxy A56). Scroll fast through the strip.
- A laptop (Mac and Windows), including on battery.
- With **Motion: Off** (button in the top bar): everything must still read and work.

If something stutters, describe *when*: while the finger is down, while it glides after you
let go, or only the first time. That points straight at the cause.

---

## 7. Working with Claude Code

This site was built with Claude Code over 3–4 October 2026. To continue:
- Open the project folder in Claude Code. It reads `CLAUDE.md` first.
- Be specific and send screenshots: "the script word overlaps the border on iPhone" beats "fix the hero".
- Ask it to verify (screenshots, measurements) before calling something done, and test on
  your phones yourself afterwards.
- Read `docs/PROJECT-LOG.md` → *Don't* list before big changes.
