/** Admin page guard: 'off' (not configured), 'login' (not signed in) or 'ok'. */
import type { AstroCookies } from 'astro';
import { features } from '../env';
import { isAdmin } from './auth';

export function adminState(cookies: AstroCookies): 'off' | 'login' | 'ok' {
  if (!features.admin) return 'off';
  return isAdmin(cookies) ? 'ok' : 'login';
}
