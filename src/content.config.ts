import { defineCollection, reference } from 'astro:content';
import { file } from 'astro/loaders';
import { z } from 'astro/zod';

/** Every collection file is `{ "$comment": "...how to edit...", "items": [...] }`. */
const items = (text: string) => JSON.parse(text).items;

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const mediaKey = z.string();

const events = defineCollection({
  loader: file('src/content/events.json', { parser: items }),
  schema: z.object({
    order: z.number(),
    theme: z.enum(['sfc', 'uts', 'main', 'base']),
    slug: z.string(),
    name: z.string(),
    shortName: z.string(),
    title: z.array(z.string()).min(1),
    script: z.string().optional(),
    kicker: z.string(),
    tagline: z.string(),
    lineupTitle: z.string(),
    summary: z.string(),
    description: z.array(z.string()),
    date,
    dateLabel: z.string(),
    time: z.string(),
    venue: z.string(),
    hero: mediaKey,
    trailer: mediaKey.nullable(),
    ticketUrl: z.string(),
    /** Media keys for this event's frames in the home film strip. */
    strip: z.array(mediaKey).optional(),
  }),
});

const films = defineCollection({
  loader: file('src/content/films.json', { parser: items }),
  schema: z.object({
    title: z.string(),
    englishTitle: z.string().optional(),
    year: z.number(),
    director: z.string(),
    synopsis: z.string(),
    runtime: z.number().describe('minutes'),
    rating: z.string(),
    language: z.string().optional(),
    poster: mediaKey,
    trailer: mediaKey.nullable(),
    event: reference('events'),
    date,
    time: z.string(),
    venue: z.string(),
    ticketUrl: z.string(),
  }),
});

const sponsors = defineCollection({
  loader: file('src/content/sponsors.json', { parser: items }),
  schema: z.object({
    name: z.string(),
    tier: z.enum(['major', 'partner', 'community']),
    url: z.string(),
    logo: mediaKey.nullable(),
  }),
});

const faq = defineCollection({
  loader: file('src/content/faq.json', { parser: items }),
  schema: z.object({
    category: z.string(),
    question: z.string(),
    answer: z.string(),
  }),
});

const team = defineCollection({
  loader: file('src/content/team.json', { parser: items }),
  schema: z.object({
    name: z.string(),
    role: z.string(),
    division: z.string(),
    photo: mediaKey,
  }),
});

const media = defineCollection({
  loader: file('src/content/media.json', { parser: (text) => JSON.parse(text).media }),
  schema: z.object({
    type: z.enum(['image', 'video']),
    src: z.string(),
    ratio: z.string().regex(/^\d+:\d+$/),
    alt: z.string(),
    location: z.string(),
    recommended: z.string(),
    poster: z.string().optional(),
    tone: z.enum(['theme', 'black', 'sfc', 'uts', 'main', 'base']).optional(),
    halftone: z.boolean().optional(),
  }),
});

export const collections = { events, films, sponsors, faq, team, media };
