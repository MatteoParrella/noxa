// Copia il web worker di MapLibre tra i file statici: il bundler di Next non lo emette da solo.
// Il worker è servito dalla stessa origine dell'app (nessun CDN, ADR-0016).
import { copyFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const dist = path.dirname(require.resolve('maplibre-gl/package.json'));
const destinazione = new URL('../public/vendor/maplibre/', import.meta.url);
await mkdir(destinazione, { recursive: true });
await copyFile(
  path.join(dist, 'dist', 'maplibre-gl-worker.mjs'),
  new URL('maplibre-gl-worker.mjs', destinazione),
);
