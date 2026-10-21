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
 * MapLibre per le mappe piccole dell'area di moderazione (MappaPosizione), con il worker locale
 * e il protocollo PMTiles registrati una volta. La mappa di Scopri (`Mappa.tsx`) ha il suo
 * caricamento, tenuto separato: unificarli rallentava l'avvio della mappa sotto carico nei
 * test e2e.
 */
export async function caricaMaplibre(): Promise<typeof MapLibre> {
  const [maplibre, { Protocol: ProtocolloPmtiles }] = await Promise.all([
    import('maplibre-gl'),
    import('pmtiles'),
  ]);
  // Una sola volta: richiamarlo dopo che una mappa ha avviato i worker la blocca al caricamento.
  if (!protocolloPmtiles) {
    maplibre.setWorkerUrl(URL_WORKER);
    protocolloPmtiles = new ProtocolloPmtiles();
    maplibre.addProtocol('pmtiles', protocolloPmtiles.tile);
  }
  return maplibre;
}
