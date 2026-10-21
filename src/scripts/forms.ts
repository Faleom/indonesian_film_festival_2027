/**
 * Forms and the cart, enhanced. Every form posts to a real endpoint and works
 * without JS (the server redirects to a result page). With JS:
 *   form[data-api]   sends with fetch, shows the reply in the toast, follows
 *                    `redirect` (e.g. to Stripe) when the server gives one
 *   form[data-cart]  adds to the cart without leaving the page, updates the count
 *   a[data-coming-soon] shows a message instead of navigating
 * Also: the cart count in the header (read from the iff_cart cookie) and an
 * anonymous page-view beacon.
 */
let timer: number | undefined;

export function toast(message: string, tone: 'ok' | 'error' = 'ok') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.dataset.tone = tone;
  el.hidden = false;
  window.clearTimeout(timer);
  timer = window.setTimeout(() => (el.hidden = true), 6500);
}

function cartCount(): number {
  const raw = document.cookie.split('; ').find((c) => c.startsWith('iff_cart='))?.slice(9);
  if (!raw) return 0;
  try {
    return Object.values(JSON.parse(decodeURIComponent(raw)) as Record<string, number>).reduce((a, b) => a + Number(b || 0), 0);
  } catch {
    return 0;
  }
}

function showCartCount(n = cartCount()) {
  document.querySelectorAll<HTMLElement>('[data-cart-count]').forEach((el) => {
    el.textContent = String(n);
    el.hidden = n === 0;
  });
}

async function send(form: HTMLFormElement, submitter: HTMLElement | null) {
  const button = (submitter ?? form.querySelector('[type="submit"]')) as HTMLButtonElement | null;
  const label = button?.textContent;
  if (button) {
    button.disabled = true;
    button.dataset.busy = '';
  }
  try {
    const body = new FormData(form, submitter);
    // getAttribute: a field named "action" would shadow form.action.
    const res = await fetch(form.getAttribute('action') ?? location.href, { method: 'POST', body, headers: { Accept: 'application/json' } });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; redirect?: string; count?: number };
    if (data.redirect) {
      toast(data.message || 'One moment…');
      location.href = data.redirect;
      return;
    }
    if (typeof data.count === 'number') showCartCount(data.count);
    toast(data.message || (res.ok ? 'Done!' : 'Something went wrong. Please try again.'), res.ok && data.ok !== false ? 'ok' : 'error');
    if (res.ok && data.ok !== false && form.hasAttribute('data-reset')) form.reset();
    if (res.ok && form.hasAttribute('data-reload')) location.reload();
  } catch {
    toast("Couldn't reach the server. Check your connection and try again.", 'error');
  } finally {
    if (button) {
      button.disabled = false;
      delete button.dataset.busy;
      if (label) button.textContent = label;
    }
  }
}

// Capture phase: runs before the page-transition router, which would otherwise
// turn the POST into a page navigation.
document.addEventListener(
  'submit',
  (e) => {
    const form = e.target;
    if (!(form instanceof HTMLFormElement) || !(form.hasAttribute('data-api') || form.hasAttribute('data-cart'))) return;
    e.preventDefault();
    e.stopPropagation();
    send(form, (e as SubmitEvent).submitter);
  },
  true,
);

// Capture phase, so it runs before the page-transition router handles the link.
document.addEventListener(
  'click',
  (e) => {
    const link = (e.target as Element | null)?.closest?.('a[data-coming-soon]');
    if (!(link instanceof HTMLAnchorElement)) return;
    e.preventDefault();
    toast(link.dataset.comingSoon || 'Coming soon.');
  },
  true,
);

document.addEventListener('astro:page-load', () => {
  showCartCount();
  // Messages handed over in the URL (?msg= / ?error=) after a no-JS redirect.
  const params = new URLSearchParams(location.search);
  const err = params.get('error');
  if (err && err.length > 2) toast(err, 'error');
  try {
    if (!location.pathname.startsWith('/admin')) navigator.sendBeacon?.('/api/pv', location.pathname);
  } catch {}
});
