/**
 * Canvas-drawn and loaded textures for the 3D film strip. Everything is
 * drawn in greys: the halftone pass prints it in the current event's inks.
 * White prints nothing (paper shows through), black prints solid ink.
 */
import { CanvasTexture, SRGBColorSpace, TextureLoader, VideoTexture, type Texture } from 'three';

const fonts = () => {
  const root = getComputedStyle(document.documentElement);
  return {
    display: root.getPropertyValue('--ff-display').trim() || 'sans-serif',
    type: root.getPropertyValue('--ff-typewriter').trim() || 'monospace',
  };
};

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext('2d')! };
}

function finish(c: HTMLCanvasElement): CanvasTexture {
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Film frame border: dark film with sprocket holes and a transparent picture window. */
export function filmFrameTexture(): CanvasTexture {
  const W = 1000;
  const H = 810; // 2.0 x 1.62 units
  const { c, ctx } = canvas(W, H);
  ctx.fillStyle = '#262626';
  ctx.fillRect(0, 0, W, H);
  // Picture window (1.6 x 1.2 units, centred)
  const wx = W * 0.1;
  const wy = H * (0.21 / 1.62);
  ctx.clearRect(wx, wy, W * 0.8, H * (1.2 / 1.62));
  // Sprocket holes, top and bottom rows
  const holes = 5;
  const hw = W * 0.07;
  const hh = H * 0.06;
  for (const y of [H * 0.035, H - H * 0.035 - hh]) {
    for (let i = 0; i < holes; i++) {
      const x = (W / holes) * (i + 0.5) - hw / 2;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, y, hw, hh, hh * 0.3);
      ctx.clip();
      ctx.clearRect(x, y, hw, hh);
      ctx.restore();
    }
  }
  // Edge print, light on dark (prints as paper showing through the ink), in
  // the strip between the sprocket holes and the picture.
  ctx.fillStyle = '#d8d8d8';
  ctx.font = `600 16px ${fonts().type}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('INDONESIAN FILM FESTIVAL  ▸  21', wx, wy - 7);
  return finish(c);
}

/** Title card for an event: big number, name, date, in the site's fonts. */
export function titleCardTexture(opts: { number: number; total: number; name: string; date: string }): CanvasTexture {
  const W = 1200;
  const H = 900;
  const { c, ctx } = canvas(W, H);
  const f = fonts();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#000000';
  ctx.font = `400 44px ${f.type}`;
  ctx.fillText(`EVENT ${String(opts.number).padStart(2, '0')} / ${String(opts.total).padStart(2, '0')}`, 70, 100);
  ctx.fillRect(70, 125, W - 140, 4);

  // Event name, wrapped onto up to 3 lines, as large as fits: every line
  // (including a single long word) inside the margins, above the date.
  const words = opts.name.toUpperCase().split(' ');
  const maxW = W - 140;
  const maxH = H - 190 - 170;
  let size = 300;
  let lines: string[] = [];
  for (; size > 60; size -= 6) {
    ctx.font = `400 ${size}px ${f.display}`;
    lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = w;
      } else line = test;
    }
    lines.push(line);
    const fits = lines.every((l) => ctx.measureText(l).width <= maxW) && lines.length * size * 0.86 <= maxH;
    if (fits && lines.length <= 3) break;
  }
  lines.forEach((l, i) => ctx.fillText(l, 66, 190 + size * 0.86 * (i + 1)));

  ctx.font = `400 50px ${f.type}`;
  ctx.fillText(opts.date.toUpperCase(), 70, H - 80);
  // Big faint number, like a print registration mark
  ctx.globalAlpha = 0.12;
  ctx.font = `400 520px ${f.display}`;
  ctx.textAlign = 'right';
  ctx.fillText(String(opts.number).padStart(2, '0'), W - 40, H - 40);
  return finish(c);
}

/** Placeholder for b-roll / posters that haven't been delivered yet. */
export function placeholderTexture(label: string): CanvasTexture {
  const W = 1200;
  const H = 900;
  const { c, ctx } = canvas(W, H);
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#f2f2f2');
  bg.addColorStop(1, '#b8b8b8');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // A figure-like shape, as in the CSS placeholders.
  const g = ctx.createRadialGradient(W * 0.52, H * 0.6, 20, W * 0.52, H * 0.62, H * 0.5);
  g.addColorStop(0, '#3a3a3a');
  g.addColorStop(0.6, '#7a7a7a');
  g.addColorStop(1, 'rgba(120,120,120,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(W * 0.52, H * 0.78, W * 0.24, H * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(W * 0.5, H * 0.3, H * 0.12, 0, Math.PI * 2);
  ctx.fillStyle = '#4a4a4a';
  ctx.fill();
  const fade = ctx.createLinearGradient(0, H * 0.7, 0, H);
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(1, 'rgba(0,0,0,0.85)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, W, H);
  // Label box
  ctx.font = `400 46px ${fonts().type}`;
  const tw = ctx.measureText(label).width;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(W / 2 - tw / 2 - 30, H / 2 - 50, tw + 60, 90);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 4;
  ctx.strokeRect(W / 2 - tw / 2 - 30, H / 2 - 50, tw + 60, 90);
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.fillText(label, W / 2, H / 2 + 12);
  return finish(c);
}

export interface LoadedTexture {
  texture: Texture;
  video?: HTMLVideoElement;
  aspect: number;
}

/** Loads an image or (muted, looping) video as a texture. */
export async function loadMediaTexture(src: string, type: 'image' | 'video'): Promise<LoadedTexture> {
  if (type === 'video') {
    const video = document.createElement('video');
    Object.assign(video, { src, muted: true, loop: true, playsInline: true, crossOrigin: 'anonymous', preload: 'auto' });
    video.setAttribute('muted', '');
    await new Promise<void>((resolve, reject) => {
      video.addEventListener('loadeddata', () => resolve(), { once: true });
      video.addEventListener('error', () => reject(new Error(`Video failed: ${src}`)), { once: true });
    });
    const texture = new VideoTexture(video);
    texture.colorSpace = SRGBColorSpace;
    return { texture, video, aspect: video.videoWidth / video.videoHeight || 16 / 9 };
  }
  const texture = await new TextureLoader().loadAsync(src);
  texture.colorSpace = SRGBColorSpace;
  const img = texture.image as HTMLImageElement;
  return { texture, aspect: img.width / img.height || 4 / 3 };
}

/** Crops a texture to cover a plane of the given aspect, centred. */
export function coverFit(texture: Texture, textureAspect: number, planeAspect: number) {
  texture.repeat.set(1, 1);
  texture.offset.set(0, 0);
  if (textureAspect > planeAspect) {
    texture.repeat.x = planeAspect / textureAspect;
    texture.offset.x = (1 - texture.repeat.x) / 2;
  } else {
    texture.repeat.y = textureAspect / planeAspect;
    texture.offset.y = (1 - texture.repeat.y) / 2;
  }
}
