/** Fundraiser status helpers. No astro:content imports, so browser scripts can use them too. */

export type SupportStatus = 'soon' | 'open' | 'closed';

/** Today's date in Melbourne as YYYY-MM-DD. */
export const melbourneToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne' }).format(new Date());

/** Where a fundraiser is on a given day (dates are YYYY-MM-DD, inclusive). */
export function supportStatus(open: string, close: string, today = melbourneToday()): SupportStatus {
  return today < open ? 'soon' : today > close ? 'closed' : 'open';
}
