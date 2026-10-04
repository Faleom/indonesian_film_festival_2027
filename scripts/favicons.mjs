// Generates the site icons from the festival logo.
// Source: src/assets/brand/logo.svg or logo.png. Either dark on light, or a
// single-colour logo on a transparent background (e.g. the white IFF logo):
// transparent logos are printed in black (same shape, from their alpha) so
// they show on the white icon background and the light header.
// Output (public/): favicon.ico (16/32/48), icon-192.png, icon-512.png,
// apple-touch-icon.png (180), icon.svg (if the source is SVG), site.webmanifest,
// brand/logo.png (black on transparent, 360px tall, for the site header).
// Runs before dev/build. Without a logo it generates a neutral interim icon.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const brandDir = path.join(root, 'src/assets/brand');
const out = path.join(root, 'public');
const logo = ['logo.svg', 'logo.png', 'logo.jpg', 'logo.webp'].map((f) => path.join(brandDir, f)).find((f) => fs.existsSync(f));

// Until the real logo is added, use a neutral stand-in: a halftone dot disc in
// the festival purple (the site's dot motif, not a logo).
const INTERIM = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><pattern id="d" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="3" fill="#7200b8"/></pattern><clipPath id="c"><circle cx="32" cy="32" r="28"/></clipPath></defs><circle cx="32" cy="32" r="29" fill="none" stroke="#7200b8" stroke-width="3"/><rect width="64" height="64" fill="url(#d)" clip-path="url(#c)"/></svg>`;
const source = logo ?? Buffer.from(INTERIM);
if (!logo) console.log('[favicons] No src/assets/brand/logo.(svg|png) yet, using the interim dot icon.');

const stampFile = path.join(out, '.favicons-stamp');
const stamp = logo ? `${path.basename(logo)}:${fs.statSync(logo).mtimeMs}:v2` : 'interim:1';
const headerLogo = path.join(out, 'brand/logo.png');
if (fs.existsSync(stampFile) && fs.readFileSync(stampFile, 'utf8') === stamp && fs.existsSync(path.join(out, 'favicon.ico')) && (!logo || fs.existsSync(headerLogo))) {
  console.log('[favicons] Up to date.');
  process.exit(0);
}

/**
 * The logo as black ink on transparent. A raster logo with transparency is
 * recoloured from its alpha (shape unchanged); anything else is used as is.
 */
async function ink(src) {
  if (typeof src !== 'string' || src.endsWith('.svg')) return src;
  const meta = await sharp(src).metadata();
  if (!meta.hasAlpha) return src;
  const alpha = await sharp(src).extractChannel('alpha').toBuffer();
  return sharp({ create: { width: meta.width, height: meta.height, channels: 3, background: { r: 0, g: 0, b: 0 } } })
    .joinChannel(alpha)
    .png()
    .toBuffer();
}
const inked = await ink(source);

const BG = { r: 255, g: 255, b: 255, alpha: 1 };
/** Logo centred on a white square with padding (keeps it visible on dark tabs). */
async function icon(size, padding = 0.1) {
  const inner = Math.round(size * (1 - padding * 2));
  const logo = await sharp(inked, { density: 600 })
    .flatten({ background: BG })
    .trim({ background: '#ffffff', threshold: 10 })
    .resize(inner, inner, { fit: 'contain', background: BG })
    .png()
    .toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: logo, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** ICO container holding PNG images (supported by every current browser). */
function ico(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = 6 + pngs.length * 16;
  const dir = pngs.map(({ size, data }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    return e;
  });
  return Buffer.concat([header, ...dir, ...pngs.map((p) => p.data)]);
}

const small = await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await icon(size, 0.04) })));
fs.writeFileSync(path.join(out, 'favicon.ico'), ico(small));
fs.writeFileSync(path.join(out, 'icon-192.png'), await icon(192));
fs.writeFileSync(path.join(out, 'icon-512.png'), await icon(512));
fs.writeFileSync(path.join(out, 'apple-touch-icon.png'), await icon(180, 0.12));
// Header logo: black on transparent, trimmed, 360px tall (crisp at 3x for a ~48px mark).
if (logo) {
  fs.mkdirSync(path.dirname(headerLogo), { recursive: true });
  await sharp(inked, { density: 600 }).trim({ threshold: 1 }).resize({ height: 360 }).png({ compressionLevel: 9 }).toFile(headerLogo);
}
if (!logo) fs.writeFileSync(path.join(out, 'icon.svg'), INTERIM);
else if (logo.endsWith('.svg')) fs.copyFileSync(logo, path.join(out, 'icon.svg'));
else fs.rmSync(path.join(out, 'icon.svg'), { force: true });

fs.writeFileSync(
  path.join(out, 'site.webmanifest'),
  JSON.stringify(
    {
      name: '21st Indonesian Film Festival',
      short_name: 'IFF 21',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
      theme_color: '#7200b8',
      background_color: '#eae4d8',
      display: 'standalone',
    },
    null,
    2,
  ) + '\n',
);
fs.writeFileSync(stampFile, stamp);
console.log(`[favicons] Generated icons from ${logo ? path.basename(logo) : 'the interim dot icon'}.`);
