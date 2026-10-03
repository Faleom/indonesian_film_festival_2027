import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  vite: {
    plugins: [tailwindcss()],
    build: {
      // Three.js (~575 kB min / ~143 kB gzip) is one lazy chunk that only loads
      // on desktop next to a 3D spot, so the default 500 kB warning is expected.
      chunkSizeWarningLimit: 650,
    },
  },
});
