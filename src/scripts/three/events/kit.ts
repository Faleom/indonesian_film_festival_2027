/**
 * Building blocks for the event scenes. Only tone matters: the halftone pass
 * turns darkness into dot size (0 = solid ink, 1 = bare paper), so parts use
 * different greys to read clearly as dots. Pure white (`paper`) prints
 * nothing and reads as light (screens, lit pages).
 */
import {
  BoxGeometry,
  Color,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type BufferGeometry,
  type Material,
} from 'three';

/** Lit, flat-shaded grey. */
export const grey = (g: number) => new MeshStandardMaterial({ color: new Color(g, g, g), roughness: 1, metalness: 0, flatShading: true });
/** Unlit grey (prints the same tone from every angle). */
export const flat = (g: number) => new MeshBasicMaterial({ color: new Color(g, g, g) });
/** Unlit white: no ink, reads as light. */
export const paper = () => new MeshBasicMaterial({ color: 0xffffff });
/** See-through light: lightens whatever ink is behind it (beams, glows). */
export const glow = (opacity = 0.35) => new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity, depthWrite: false });

export const box = (w: number, h: number, d: number, m: Material) => new Mesh(new BoxGeometry(w, h, d), m);
export const mesh = (g: BufferGeometry, m: Material) => new Mesh(g, m);

/** Deterministic random (same layout every visit). */
export function rng(seed = 21) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}
