// Halftone pipeline: src/assets/raw/<media-key>.<ext> -> public/images/halftone/
//
// For each photo it writes, all with transparent paper so the page's beige
// shows through and the bottom edge fading out:
//   <key>-black.png             pure black dots
//   <key>-<theme>.png           dots in each theme's primary colour (sfc/uts/main/base)
//   <key>-<variant>-<w>.png     smaller copies for srcset (config.smallWidths)
//   <key>-tex.jpg               greyscale texture for the 3D film strip (printed as dots by the shader)
// plus manifest.json (sizes + hashes, read by <Media> and used for caching).
// PNG with a 16-colour palette is ~2x smaller than WebP for flat dot patterns.
//
// Settings: halftone.config.json. Run: `npm run halftone` (also runs before dev/build).
// Flags: --force (ignore cache)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const root = process.cwd();
const force = process.argv.includes('--force');
const config = JSON.parse(fs.readFileSync(path.join(root, 'halftone.config.json'), 'utf8'));
const inputDir = path.join(root, config.input);
const outputDir = path.join(root, config.output);
const manifestPath = path.join(outputDir, 'manifest.json');
// Bump when the rendering code changes, so cached outputs are regenerated.
const PIPELINE_VERSION = 3;
const EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff', '.avif']);

// Theme primaries come from themes.css so colours never drift from the site.
function readThemePrimaries() {
  const css = fs.readFileSync(path.join(root, 'src/styles/themes.css'), 'utf8');
  const themes = {};
  for (const id of ['sfc', 'uts', 'main', 'base']) {
    const block = css.split(`[data-theme='${id}']`)[1]?.split('}')[0] ?? '';
    const hex = block.match(/--c-primary:\s*#([0-9a-f]{6})/i)?.[1];
    if (!hex) throw new Error(`Could not read --c-primary for theme "${id}" from themes.css`);
    themes[id] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  }
  return themes;
}

function settingsFor(key) {
  const { overrides = {}, ...base } = config;
  return { ...base, ...(overrides[key] ?? {}) };
}

/**
 * Returns an 8-bit alpha mask of halftone dots: 255 = ink.
 * Dots sit on a grid rotated by `angle`; each dot's area follows the
 * darkness of the (blurred) photo at its centre, and shrinks to nothing
 * across the bottom `fade` fraction of the image. Each pixel checks the 3x3
 * neighbouring dots so large dots in dark areas merge cleanly.
 */
function renderDots(gray, width, height, { dotSize, angle, fade }) {
  const mask = new Uint8ClampedArray(width * height);
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const maxR = dotSize * 0.72; // > cell half-diagonal, so pure black fills solid
  const radiusCache = new Map();

  const radiusAt = (i, j) => {
    const id = i * 100003 + j;
    let r = radiusCache.get(id);
    if (r !== undefined) return r;
    // Dot centre back in image space.
    const u = i * dotSize;
    const v = j * dotSize;
    // Clamped so dots just outside the frame still fill the edges.
    const x = Math.min(width - 1, Math.max(0, Math.round(u * cos - v * sin)));
    const y = Math.min(height - 1, Math.max(0, Math.round(u * sin + v * cos)));
    r = maxR * Math.sqrt(1 - gray[y * width + x] / 255);
    radiusCache.set(id, r);
    return r;
  };

  const fadeStart = height * (1 - fade);

  for (let y = 0; y < height; y++) {
    const fadeK = fade > 0 && y > fadeStart ? Math.max(0, 1 - (y - fadeStart) / (height - fadeStart)) : 1;
    if (fadeK === 0) continue;
    for (let x = 0; x < width; x++) {
      // Pixel in rotated grid space.
      const u = x * cos + y * sin;
      const v = -x * sin + y * cos;
      const ci = Math.round(u / dotSize);
      const cj = Math.round(v / dotSize);
      let coverage = 0;
      for (let di = -1; di <= 1 && coverage < 1; di++) {
        for (let dj = -1; dj <= 1; dj++) {
          // The bottom fade shrinks dots rather than lowering opacity: smoother on
          // a palette PNG and closer to how ink actually thins out.
          const r = radiusAt(ci + di, cj + dj) * fadeK;
          if (r <= 0) continue;
          const du = u - (ci + di) * dotSize;
          const dv = v - (cj + dj) * dotSize;
          const c = r - Math.sqrt(du * du + dv * dv) + 0.5; // 1px anti-aliasing
          if (c > coverage) coverage = c >= 1 ? 1 : c;
        }
      }
      if (coverage > 0) mask[y * width + x] = coverage * 255;
    }
  }
  return mask;
}

function tintedRgba(mask, [r, g, b]) {
  const out = Buffer.alloc(mask.length * 4);
  for (let p = 0, q = 0; p < mask.length; p++, q += 4) {
    out[q] = r;
    out[q + 1] = g;
    out[q + 2] = b;
    out[q + 3] = mask[p];
  }
  return out;
}

/** Deletes outputs for photos that are no longer in the raw folder. */
function removeStale(previous, manifest) {
  for (const key of Object.keys(previous)) {
    if (manifest[key]) continue;
    for (const v of Object.values(previous[key].variants ?? {})) {
      for (const url of [v.src, ...(v.srcset ?? []).map((s) => s.src)]) {
        fs.rmSync(path.join(root, 'public', url), { force: true });
      }
    }
    if (previous[key].texture) fs.rmSync(path.join(root, 'public', previous[key].texture), { force: true });
    console.log(`[halftone] Removed outputs for deleted photo "${key}".`);
  }
}

const hash = (data) => crypto.createHash('sha1').update(data).digest('hex').slice(0, 12);

async function main() {
  const files = fs.existsSync(inputDir)
    ? fs.readdirSync(inputDir).filter((f) => EXTENSIONS.has(path.extname(f).toLowerCase()))
    : [];

  const previous = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};

  if (files.length === 0) {
    if (Object.keys(previous).length > 0) {
      removeStale(previous, {});
      fs.rmSync(manifestPath, { force: true });
    }
    console.log(`[halftone] No photos in ${config.input}, skipping (placeholders stay).`);
    return;
  }

  const themes = readThemePrimaries();
  const mediaKeys = new Set(
    Object.keys(JSON.parse(fs.readFileSync(path.join(root, 'src/content/media.json'), 'utf8')).media),
  );
  const manifest = {};
  fs.mkdirSync(outputDir, { recursive: true });

  let processed = 0;
  for (const file of files) {
    const key = path.basename(file, path.extname(file));
    const settings = settingsFor(key);
    const sourceHash = hash(fs.readFileSync(path.join(inputDir, file)));
    const settingsHash = hash(JSON.stringify({ settings, themes, v: PIPELINE_VERSION }));
    const variants = ['black', ...Object.keys(themes)];

    if (!mediaKeys.has(key)) {
      console.warn(`[halftone] "${file}" doesn't match a key in media.json; processed anyway as "${key}".`);
    }

    const prev = previous[key];
    const upToDate =
      !force &&
      prev?.sourceHash === sourceHash &&
      prev?.settingsHash === settingsHash &&
      Object.values(prev.variants ?? {}).every((v) =>
        [v.src, ...v.srcset.map((s) => s.src)].every((url) => fs.existsSync(path.join(root, 'public', url))),
      ) &&
      !!prev.texture &&
      fs.existsSync(path.join(root, 'public', prev.texture));
    if (upToDate) {
      manifest[key] = prev;
      continue;
    }

    const { data: gray, info } = await sharp(path.join(inputDir, file))
      .rotate() // respect EXIF orientation
      .resize({ width: settings.maxWidth, withoutEnlargement: true })
      .greyscale()
      .normalise()
      .linear(settings.contrast, -(128 * settings.contrast) + 128)
      .gamma(Math.max(1, settings.gamma), Math.max(1, settings.gamma))
      .blur(Math.max(0.3, settings.dotSize / 3))
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { width, height } = info;
    const mask = renderDots(gray, width, height, settings);

    const colours = { black: [0, 0, 0], ...themes };
    const urlBase = '/' + config.output.replace(/^public\/?/, '');
    const widths = (settings.smallWidths ?? []).filter((w) => w < width);
    const encode = (img) => img.png({ palette: true, colours: 16, dither: 0, compressionLevel: 9, effort: 8 });

    const variantEntries = await Promise.all(
      variants.map(async (v) => {
        const full = sharp(tintedRgba(mask, colours[v]), { raw: { width, height, channels: 4 } });
        const name = `${key}-${v}`;
        await encode(full.clone()).toFile(path.join(outputDir, `${name}.png`));
        const srcset = [];
        for (const w of widths) {
          await encode(full.clone().resize({ width: w })).toFile(path.join(outputDir, `${name}-${w}.png`));
          srcset.push({ src: `${urlBase}/${name}-${w}.png`, width: w });
        }
        srcset.push({ src: `${urlBase}/${name}.png`, width });
        return [v, { src: `${urlBase}/${name}.png`, srcset }];
      }),
    );

    // Plain greyscale copy for WebGL textures (the 3D shader does its own halftoning).
    const texture = `${urlBase}/${key}-tex.jpg`;
    await sharp(path.join(inputDir, file))
      .rotate()
      .resize({ width: 1024, withoutEnlargement: true })
      .greyscale()
      .normalise()
      .jpeg({ quality: 78, mozjpeg: true })
      .toFile(path.join(root, 'public', texture));

    manifest[key] = {
      width,
      height,
      texture,
      variants: Object.fromEntries(variantEntries),
      sourceHash,
      settingsHash,
    };
    processed++;
    console.log(`[halftone] ${file} -> ${variants.length} variants x ${widths.length + 1} sizes (${width}x${height}, dot ${settings.dotSize}px)`);
  }

  removeStale(previous, manifest);

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  const cached = files.length - processed;
  console.log(`[halftone] Done: ${processed} processed, ${cached} up to date.`);
}

main().catch((err) => {
  console.error('[halftone] Failed:', err);
  process.exit(1);
});
