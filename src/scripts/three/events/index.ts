/** Event hero scenes, keyed by events.json `heroScene`. Each is its own chunk: a page downloads only its scene. */
import type { EventBuilder } from '../eventScene';

export const eventScenes: Record<string, () => Promise<EventBuilder>> = {
  clapper: async () => (await import('./sfc')).buildSfc,
  gallery: async () => (await import('./exhibition')).buildExhibition,
  'open-air': async () => (await import('./uts')).buildUts,
  book: async () => (await import('./edu')).buildEdu,
  theatre: async () => (await import('./main')).buildMain,
};
