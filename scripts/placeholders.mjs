// Regenerates PLACEHOLDERS.md from src/content/media.json.
// Run after adding real assets: `npm run placeholders`
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const { media } = JSON.parse(fs.readFileSync(path.join(root, 'src/content/media.json'), 'utf8'));

const rawDir = path.join(root, 'src/assets/raw');
const rawFiles = fs.existsSync(rawDir) ? fs.readdirSync(rawDir) : [];
const rawFor = (key) => rawFiles.find((f) => path.parse(f).name === key);

const rows = Object.entries(media).map(([key, m]) => {
  const raw = m.type === 'image' && m.halftone !== false ? rawFor(key) : undefined;
  const present = fs.existsSync(path.join(root, 'public', m.src));
  const status = raw ? `✅ halftone (raw/${raw})` : present ? '✅ delivered' : '⬜ placeholder';
  return { key, ...m, status };
});

const pending = rows.filter((r) => !r.status.startsWith('✅')).length;

const md = `# Placeholders

Every image and video on the site is defined once in \`src/content/media.json\`.
Until the real file exists, \`<Media id="key" />\` renders a halftone placeholder labelled \`[IMG: key ratio]\` or \`[VIDEO: key ratio]\`.

**To swap in a real photo (halftone look):** save it as \`src/assets/raw/<key>.jpg\` (any of jpg/png/webp/tif/avif). The halftone pipeline turns it into dots in the theme colour on the next \`npm run dev\` / \`npm run build\` (or run \`npm run halftone\`).

**To use a file as-is (videos, logos, untreated photos):** save it at the file path below (inside \`/public\`). For images, also set \`"halftone": false\` for that key in \`media.json\`.

Then run \`npm run placeholders\` to refresh this list. To use a different filename, change \`src\` for that key in \`media.json\`.

_${pending} of ${rows.length} still pending. Generated from media.json; don't edit by hand._

| Key | Type | Location | Ratio | Recommended size | File path (as-is) | Status |
|---|---|---|---|---|---|---|
${rows.map((r) => `| \`${r.key}\` | ${r.type} | ${r.location} | ${r.ratio} | ${r.recommended} | \`public${r.src}\` | ${r.status} |`).join('\n')}

## Other placeholders

| Item | Location | Notes |
|---|---|---|
| 3D camera model | \`<HalftoneCamera />\` (styleguide now, home hero in Phase 7) | Procedural low-poly camera until \`public/models/camera.glb\` is provided. After adding it, run \`npm run render:3d-fallback\` with the site running to refresh the static fallback (\`public/images/camera-fallback.png\`) |
| Fonts | \`public/fonts\` | See \`src/content/fonts.json\` for exact filenames. Missing files fall back to Bebas Neue / Oswald / Jost / cursive |
`;

fs.writeFileSync(path.join(root, 'PLACEHOLDERS.md'), md);
console.log(`PLACEHOLDERS.md written: ${rows.length} keys, ${pending} pending.`);
