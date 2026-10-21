/** Codes and tokens. Crockford-style alphabet: no 0/O or 1/I/L to misread at the door. */
import { randomBytes } from 'node:crypto';

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export function randomCode(length: number): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/** Ticket code printed under the QR, e.g. IFF21-7KQ2-M9XA. */
export const ticketCode = () => `IFF21-${randomCode(4)}-${randomCode(4)}`;
/** Short order reference for emails and the committee, e.g. IFF-7KQ2M9. */
export const orderReference = () => `IFF-${randomCode(6)}`;
/** Unguessable token for the buyer's order page. */
export const publicToken = () => randomBytes(24).toString('base64url');

/** Normalises what people type at the door: lower case, spaces, missing dashes. */
export function normaliseTicketCode(input: string): string {
  const raw = input.toUpperCase().replace(/[^0-9A-Z]/g, '');
  const body = raw.startsWith('IFF21') ? raw.slice(5) : raw;
  return body.length === 8 ? `IFF21-${body.slice(0, 4)}-${body.slice(4)}` : input.trim().toUpperCase();
}
