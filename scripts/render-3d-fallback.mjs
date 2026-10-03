// Renders the halftone 3D camera once and saves it as the static fallback
// (public/images/camera-fallback.png), shown on phones, with
// reduced motion, without JS, and while the live scene loads.
//
// Usage: start the site (`npm run dev` or `npm run preview`), then
//   npm run render:3d-fallback [-- http://localhost:4321]
// Needs Google Chrome installed (set CHROME_PATH if it isn't in the default place).
// Rerun after replacing the model (public/models/camera.glb).
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import path from 'node:path';

const base = process.argv[2] ?? 'http://localhost:4321';
const chrome = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const out = path.join(process.cwd(), 'public/images');

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: 'new',
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
  defaultViewport: { width: 1440, height: 1000, deviceScaleFactor: 2 },
});
try {
  const page = await browser.newPage();
  await page.goto(`${base}/styleguide?export-3d`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.getElementById('ht3d-demo')?.scrollIntoView({ block: 'center' }));
  await page.waitForFunction(() => typeof window.__ht3dExport === 'function', { timeout: 20000 });
  await new Promise((r) => setTimeout(r, 500));
  const dataUrl = await page.evaluate(() => window.__ht3dExport());
  const png = Buffer.from(dataUrl.split(',')[1], 'base64');

  // Trim empty space, keep a small margin, store as compact palette PNGs.
  const trimmed = await sharp(png).trim({ threshold: 1 }).extend({ top: 24, bottom: 24, left: 24, right: 24, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const encode = (img) => img.png({ palette: true, colours: 16, dither: 0, compressionLevel: 9 });
  await encode(sharp(trimmed)).toFile(path.join(out, 'camera-fallback.png'));
  const meta = await sharp(trimmed).metadata();
  console.log(`[3d-fallback] Saved camera-fallback.png (${meta.width}x${meta.height})`);
} finally {
  await browser.close();
}
