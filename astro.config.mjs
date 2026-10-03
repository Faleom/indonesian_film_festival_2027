import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  output: 'static',
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
        'gsap/Draggable',
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
