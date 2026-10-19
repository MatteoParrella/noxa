import type * as MapLibre from 'maplibre-gl';
import type { Protocol } from 'pmtiles';

/** Worker di MapLibre copiato tra i file statici (scripts/copia-maplibre-worker.mjs). */
const URL_WORKER = '/vendor/maplibre/maplibre-gl-worker.mjs';

/** Centro e limiti delle mappe: Milano, con la Brianza a nord (ADR-0016). */
export const CENTRO: [number, number] = [9.19, 45.5];
export const LIMITI: [[number, number], [number, number]] = [
  [8.65, 45.15],
  [9.6, 45.8],
];

let protocolloPmtiles: Protocol | null = null;

/**
 * MapLibre caricato solo quando serve una mappa, con il worker locale e un solo protocollo
 * PMTiles per tutta l'app: intestazione e indici del file restano in memoria tra un'apertura
 * e l'altra, senza riscaricarli.
 */
export async function caricaMaplibre(): Promise<typeof MapLibre> {
  const [maplibre, { Protocol: ProtocolloPmtiles }] = await Promise.all([
    import('maplibre-gl'),
    import('pmtiles'),
  ]);
  maplibre.setWorkerUrl(URL_WORKER);
  if (!protocolloPmtiles) {
    protocolloPmtiles = new ProtocolloPmtiles();
    maplibre.addProtocol('pmtiles', protocolloPmtiles.tile);
  }
  return maplibre;
}
