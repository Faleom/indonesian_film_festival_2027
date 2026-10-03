import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// Public URL, used for canonical links, social share tags and the sitemap.
// Set SITE_URL in Vercel once the domain is decided; until then Vercel's own
// production URL is used automatically.
const site =
  process.env.SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:4321');

// https://astro.build/config
export default defineConfig({
  output: 'static',
  site,
  // Clean URLs without a trailing slash (/sfc), matching internal links and
  // vercel.json (cleanUrls + trailingSlash: false).
  trailingSlash: 'never',
  build: { format: 'file' },
  integrations: [sitemap({ filter: (page) => !page.includes('/styleguide') })],
  vite: {
    plugins: [tailwindcss()],
    // Pre-bundle the lazily imported 3D/motion libraries at startup. Without this,
    // Vite discovers them mid-session and the dev server can serve stale chunks
    // (504 "Outdated Optimize Dep"), which silently disables the 3D scenes.
    optimizeDeps: {
      include: [
        'three',
        'three/examples/jsm/loaders/GLTFLoader.js',
        'three/examples/jsm/utils/BufferGeometryUtils.js',
        'three/examples/jsm/math/MeshSurfaceSampler.js',
        'gsap',
        'gsap/ScrollTrigger',
        'gsap/SplitText',
        'lenis',
      ],
    },
    build: {
      // Three.js (~575 kB min / ~143 kB gzip) is one lazy chunk that only loads
      // on desktop next to a 3D spot, so the default 500 kB warning is expected.
      chunkSizeWarningLimit: 650,
    },
  },
});
