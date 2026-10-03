import fs from 'node:fs';
import path from 'node:path';
import mediaData from '../content/media.json';

export type MediaType = 'image' | 'video';
export type Theme = 'sfc' | 'uts' | 'main' | 'base';
/** 'theme' = dots in the primary colour of whatever data-theme is in scope. */
export type HalftoneTone = 'theme' | 'black' | Theme;

export interface MediaEntry {
  type: MediaType;
  src: string;
  ratio: string;
  alt: string;
  location: string;
  recommended: string;
  /** Media key of the image used as a video poster. */
  poster?: string;
  /** Default halftone colour for this image. Default 'theme'. */
  tone?: HalftoneTone;
  /** false = never use the halftone version (logos, real photos). */
  halftone?: boolean;
}

export interface HalftoneVariant {
  src: string;
  srcset: { src: string; width: number }[];
}

export interface HalftoneOutput {
  width: number;
  height: number;
  /** Greyscale JPG for WebGL textures. */
  texture?: string;
  variants: Record<'black' | Theme, HalftoneVariant>;
}

export const media = mediaData.media as Record<string, MediaEntry>;
export const mediaKeys = Object.keys(media);

const publicDir = path.join(process.cwd(), 'public');

const manifestPath = path.join(publicDir, 'images', 'halftone', 'manifest.json');

/** Output of `npm run halftone` for this key, if the photo has been processed. */
export function getHalftone(key: string, entry: MediaEntry | undefined = media[key]): HalftoneOutput | undefined {
  if (!entry || entry.type !== 'image' || entry.halftone === false) return undefined;
  if (!fs.existsSync(manifestPath)) return undefined;
  // Read on every call so `npm run halftone` during dev shows up without a restart.
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Record<string, HalftoneOutput>;
  return manifest[key];
}

export const srcsetOf = (variant: HalftoneVariant) => variant.srcset.map((s) => `${s.src} ${s.width}w`).join(', ');

/** True when a real asset (halftone output or original file) is available. */
export function mediaDelivered(key: string): boolean {
  const entry = media[key];
  return !!entry && (!!getHalftone(key, entry) || mediaExists(entry));
}

/**
 * Source for a WebGL texture (3D film strip): video file, the pipeline's
 * greyscale texture, or the original image. null = draw a placeholder.
 */
export function textureFor(key: string): { type: MediaType; src: string | null; ratio: string } {
  const entry = media[key];
  if (!entry) return { type: 'image', src: null, ratio: '16:9' };
  const halftone = getHalftone(key, entry);
  const src = halftone?.texture ?? (mediaExists(entry) ? entry.src : null);
  return { type: entry.type, src, ratio: entry.ratio };
}

/** True when the asset's file is present in /public (checked at build time). */
export function mediaExists(entry: MediaEntry): boolean {
  return fs.existsSync(path.join(publicDir, entry.src));
}

/** "16:9" -> "16 / 9", for the CSS aspect-ratio property. */
export function ratioToCss(ratio: string): string {
  const [w, h] = ratio.split(':').map(Number);
  return w && h ? `${w} / ${h}` : '16 / 9';
}

export function getMedia(key: string): MediaEntry | undefined {
  return media[key];
}
