// Genera il service worker della PWA con Workbox dopo `next build` (export statico in out/).
// Precache dell'app shell; font e icone della mappa con cache-first. I tile PMTiles sono letti
// con richieste a intervalli (Range) e passano dalla rete.
import { generateSW } from 'workbox-build';

const { count, size, warnings } = await generateSW({
  globDirectory: 'out',
  globPatterns: ['**/*.{html,js,css,woff2,svg,png,webmanifest,txt}'],
  globIgnores: ['catalogo/**'],
  swDest: 'out/sw.js',
  maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
  navigateFallback: '/404.html',
  // Export statico: i parametri (?id=…, ?token_hash=…) non cambiano l'HTML della pagina, quindi
  // si ignorano tutti nel cercare la pagina in cache (ARCHITECTURE.md §3.1, routing).
  ignoreURLParametersMatching: [/.*/],
  navigateFallbackDenylist: [/^\/sw\.js$/],
  cleanupOutdatedCaches: true,
  clientsClaim: true,
  skipWaiting: true,
  sourcemap: false,
  runtimeCaching: [
    {
      urlPattern: ({ url }) => url.pathname.includes('/mappe/assets/'),
      handler: 'CacheFirst',
      options: {
        cacheName: 'mappa-risorse',
        expiration: { maxEntries: 400, maxAgeSeconds: 90 * 24 * 60 * 60 },
      },
    },
  ],
});

for (const avviso of warnings) process.stderr.write(`${avviso}\n`);
process.stdout.write(`Service worker: ${count} file in precache (${Math.round(size / 1024)} KB)\n`);
