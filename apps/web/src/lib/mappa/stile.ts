import { DARK, LIGHT, layers, type Flavor } from '@protomaps/basemaps';
import type { StyleSpecification } from 'maplibre-gl';

/** Colori della mappa letti dai token `--mappa-*` del tema attivo (tokens.css). */
export type ColoriMappa = {
  terra: string;
  acqua: string;
  parchi: string;
  edifici: string;
  stradeSecondarie: string;
  stradePrincipali: string;
  stradeScorrimento: string;
  binari: string;
  etichette: string;
  alone: string;
};

export type Tema = 'scuro' | 'chiaro';

/**
 * Flavor di Protomaps quasi monocromatico: parte da `dark`/`light` e sostituisce i colori
 * con quelli del design system, così risaltano solo i segnaposto (ADR-0016).
 */
export function flavorNoxa(tema: Tema, c: ColoriMappa): Flavor {
  const base = tema === 'scuro' ? DARK : LIGHT;
  const { pois, ...senzaPois } = base;
  return {
    ...senzaPois,
    background: c.terra,
    earth: c.terra,
    park_a: c.parchi,
    park_b: c.parchi,
    wood_a: c.parchi,
    wood_b: c.parchi,
    scrub_a: c.parchi,
    scrub_b: c.parchi,
    hospital: c.terra,
    industrial: c.terra,
    school: c.terra,
    zoo: c.parchi,
    military: c.terra,
    pedestrian: c.stradeSecondarie,
    aerodrome: c.terra,
    runway: c.stradeSecondarie,
    sand: c.terra,
    beach: c.terra,
    glacier: c.terra,
    water: c.acqua,
    buildings: c.edifici,
    pier: c.edifici,
    other: c.stradeSecondarie,
    minor_service: c.stradeSecondarie,
    minor_a: c.stradeSecondarie,
    minor_b: c.stradeSecondarie,
    link: c.stradePrincipali,
    major: c.stradePrincipali,
    highway: c.stradeScorrimento,
    tunnel_other: c.stradeSecondarie,
    tunnel_minor: c.stradeSecondarie,
    tunnel_link: c.stradePrincipali,
    tunnel_major: c.stradePrincipali,
    tunnel_highway: c.stradeScorrimento,
    bridges_other: c.stradeSecondarie,
    bridges_minor: c.stradeSecondarie,
    bridges_link: c.stradePrincipali,
    bridges_major: c.stradePrincipali,
    bridges_highway: c.stradeScorrimento,
    railway: c.binari,
    boundaries: c.binari,
    roads_label_minor: c.etichette,
    roads_label_minor_halo: c.alone,
    roads_label_major: c.etichette,
    roads_label_major_halo: c.alone,
    ocean_label: c.etichette,
    subplace_label: c.etichette,
    subplace_label_halo: c.alone,
    city_label: c.etichette,
    city_label_halo: c.alone,
    state_label: c.etichette,
    state_label_halo: c.alone,
    country_label: c.etichette,
    address_label: c.etichette,
    address_label_halo: c.alone,
  };
}

/** URL di font e icone nel bucket `mappe`, accanto al file PMTiles (ADR-0016). */
export function urlRisorse(urlPmtiles: string): string {
  return urlPmtiles.slice(0, urlPmtiles.lastIndexOf('/')) + '/assets';
}

/**
 * Stile MapLibre senza icone dei punti di interesse (nessuno sprite): la mappa mostra solo i
 * segnaposto degli eventi.
 */
export function stileMappa(
  urlPmtiles: string,
  tema: Tema,
  colori: ColoriMappa,
): StyleSpecification {
  return {
    version: 8,
    glyphs: `${urlRisorse(urlPmtiles)}/fonts/{fontstack}/{range}.pbf`,
    sources: {
      protomaps: {
        type: 'vector',
        url: `pmtiles://${urlPmtiles}`,
      },
    },
    layers: layers('protomaps', flavorNoxa(tema, colori), { lang: 'it' }),
  };
}

const NOMI: Record<keyof ColoriMappa, string> = {
  terra: '--mappa-terra',
  acqua: '--mappa-acqua',
  parchi: '--mappa-parchi',
  edifici: '--mappa-edifici',
  stradeSecondarie: '--mappa-strade-secondarie',
  stradePrincipali: '--mappa-strade-principali',
  stradeScorrimento: '--mappa-strade-scorrimento',
  binari: '--mappa-binari',
  etichette: '--mappa-etichette',
  alone: '--mappa-alone',
};

/** Legge i token della mappa dal documento. */
export function leggiColori(elemento: Element): ColoriMappa {
  const stile = getComputedStyle(elemento);
  const voci = Object.entries(NOMI).map(([chiave, variabile]) => [
    chiave,
    stile.getPropertyValue(variabile).trim(),
  ]);
  return Object.fromEntries(voci) as ColoriMappa;
}
