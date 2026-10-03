import { getCollection, getEntry, type CollectionEntry } from 'astro:content';
import sponsorsFile from '../content/sponsors.json';
import teamFile from '../content/team.json';
import faqFile from '../content/faq.json';
import eventsFile from '../content/events.json';

export type EventId = 'sfc' | 'uts' | 'edu' | 'main';
export type Theme = 'sfc' | 'uts' | 'main' | 'base';
export type EventEntry = CollectionEntry<'events'>;
export type FilmEntry = CollectionEntry<'films'>;

/** Events in journey order: SFC -> UTS -> Main. */
export async function getEvents(): Promise<EventEntry[]> {
  return (await getCollection('events')).sort((a, b) => a.data.order - b.data.order);
}

export async function getEvent(id: EventId): Promise<EventEntry> {
  const event = await getEntry('events', id);
  if (!event) throw new Error(`Event "${id}" is missing from src/content/events.json`);
  return event;
}

// The file loader returns entries sorted by id, so restore the order the
// committee wrote them in (team order, FAQ categories, sponsor order).
const byFileOrder = <T extends { id: string }>(file: { items: { id: string }[] }) => {
  const index = new Map(file.items.map((item, i) => [item.id, i]));
  return (a: T, b: T) => (index.get(a.id) ?? 0) - (index.get(b.id) ?? 0);
};

const tierOrder = { major: 0, partner: 1, community: 2 } as const;

export async function getSponsors(): Promise<CollectionEntry<'sponsors'>[]> {
  const order = byFileOrder<CollectionEntry<'sponsors'>>(sponsorsFile);
  return (await getCollection('sponsors')).sort((a, b) => tierOrder[a.data.tier] - tierOrder[b.data.tier] || order(a, b));
}

export async function getTeam(): Promise<CollectionEntry<'team'>[]> {
  return (await getCollection('team')).sort(byFileOrder(teamFile));
}

export async function getFaq(): Promise<CollectionEntry<'faq'>[]> {
  return (await getCollection('faq')).sort(byFileOrder(faqFile));
}

/** Colour theme for an event id (Edu shares the festival's base theme). */
export function themeOf(eventId: string): Theme {
  return (eventsFile.items.find((e) => e.id === eventId)?.theme ?? 'base') as Theme;
}

export const eventHref = (event: EventEntry) => `/${event.data.slug}`;
export const filmHref = (film: FilmEntry) => `/films/${film.id}`;

/** Films sorted by date then time, optionally for one event. */
export async function getFilms(eventId?: EventId): Promise<FilmEntry[]> {
  const films = await getCollection('films', (f) => !eventId || f.data.event.id === eventId);
  return films.sort((a, b) => a.data.date.localeCompare(b.data.date) || toMinutes(a.data.time) - toMinutes(b.data.time));
}

const dateFormat = new Intl.DateTimeFormat('en-AU', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const shortDateFormat = new Intl.DateTimeFormat('en-AU', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

/** "2027-03-19" -> "Friday 19 March 2027" */
export const formatDate = (iso: string) => dateFormat.format(new Date(`${iso}T00:00:00Z`)).replace(',', '');
/** "2027-03-19" -> "Fri 19 Mar" */
export const formatShortDate = (iso: string) => shortDateFormat.format(new Date(`${iso}T00:00:00Z`)).replace(',', '');

/** Parses "7:00 PM" or "19:00" into minutes for sorting; unknown text sorts last. */
function toMinutes(time: string): number {
  const m = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!m) return 24 * 60;
  let h = Number(m[1]);
  const meridiem = m[3]?.toUpperCase();
  if (meridiem === 'PM' && h < 12) h += 12;
  if (meridiem === 'AM' && h === 12) h = 0;
  return h * 60 + Number(m[2]);
}

export const formatRuntime = (minutes: number) =>
  minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;
