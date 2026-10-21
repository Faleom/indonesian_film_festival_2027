/** Runs an admin page's queries; a database problem becomes a message on the page, not a hang or a blank 500. */
import { withTimeout } from '../db/client';

export async function adminLoad<T>(fn: () => Promise<T>): Promise<{ data?: T; error?: string }> {
  try {
    return { data: await withTimeout(fn(), 12000) };
  } catch (err) {
    console.error('[admin]', err);
    const e = err as { code?: string; message?: string };
    return { error: [e.code, e.message].filter(Boolean).join(': ') || String(err) };
  }
}
