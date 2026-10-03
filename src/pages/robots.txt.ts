import type { APIRoute } from 'astro';

/** robots.txt pointing at the sitemap; the internal styleguide is kept out of search. */
export const GET: APIRoute = ({ site }) =>
  new Response(
    ['User-agent: *', 'Allow: /', 'Disallow: /styleguide', '', `Sitemap: ${new URL('sitemap-index.xml', site).href}`, ''].join('\n'),
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
