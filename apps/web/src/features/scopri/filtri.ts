import { z } from 'zod';
import {
  aggiungiGiorni,
  dataIso,
  giornoSettimana,
  serataInCorso,
  type DataCalendario,
} from '@/lib/date';
import { trovaComune } from './comuni';

/**
 * Filtri di Scopri (PRD F-01). Le regole d'età stanno nel database (R-20, R-23): l'età massima
 * qui serve solo a restringere tra gli eventi già visibili. La posizione del telefono non entra
 * mai nei filtri salvati (R-33): si ricorda solo la scelta "usa la mia posizione".
 */

export const DISTANZE = [5, 10, 25] as const;
export type Distanza = (typeof DISTANZE)[number];

export const ETA_MASSIME = [14, 16, 18, 21] as const;
export type EtaMassima = (typeof ETA_MASSIME)[number];

const SchemaData = z.object({
  anno: z.number().int(),
  mese: z.number().int().min(1).max(12),
  giorno: z.number().int().min(1).max(31),
});

const SchemaQuando = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('stasera') }),
  z.object({ tipo: z.literal('domani') }),
  z.object({ tipo: z.literal('weekend') }),
  z.object({ tipo: z.literal('data'), data: SchemaData }),
]);
export type Quando = z.infer<typeof SchemaQuando>;

const SchemaDove = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('ovunque') }),
  z.object({ tipo: z.literal('posizione') }),
  z.object({ tipo: z.literal('comune'), comune: z.string() }),
]);
export type Dove = z.infer<typeof SchemaDove>;

const SchemaFiltri = z.object({
  quando: SchemaQuando,
  dove: SchemaDove,
  distanzaKm: z.union([z.literal(5), z.literal(10), z.literal(25)]).nullable(),
  generi: z.array(z.string()).max(11),
  etaMassima: z.union([z.literal(14), z.literal(16), z.literal(18), z.literal(21)]).nullable(),
  soloAmici: z.boolean(),
});
export type Filtri = z.infer<typeof SchemaFiltri>;

export const FILTRI_INIZIALI: Filtri = {
  quando: { tipo: 'stasera' },
  dove: { tipo: 'ovunque' },
  distanzaKm: null,
  generi: [],
  etaMassima: null,
  soloAmici: false,
};

/** Intervallo di serate [dal, al] per la scelta "quando", a partire dalla serata in corso. */
export function intervallo(
  quando: Quando,
  oggi: DataCalendario = serataInCorso(),
): [DataCalendario, DataCalendario] {
  switch (quando.tipo) {
    case 'stasera':
      return [oggi, oggi];
    case 'domani': {
      const domani = aggiungiGiorni(oggi, 1);
      return [domani, domani];
    }
    case 'weekend': {
      // Da venerdì a domenica; nel weekend si parte dalla serata in corso.
      const giorno = giornoSettimana(oggi);
      const domenica = aggiungiGiorni(oggi, 6 - giorno);
      const venerdi = aggiungiGiorni(oggi, Math.max(0, 4 - giorno));
      return [venerdi, domenica];
    }
    case 'data':
      return [quando.data, quando.data];
  }
}

/** Numero di filtri attivi oltre al "quando", mostrato sul pulsante Filtri. */
export function filtriAttivi(filtri: Filtri): number {
  return (
    (filtri.dove.tipo === 'ovunque' ? 0 : 1) +
    (filtri.generi.length > 0 ? 1 : 0) +
    (filtri.etaMassima === null ? 0 : 1) +
    (filtri.soloAmici ? 1 : 0)
  );
}

export type Coordinate = { lat: number; lon: number };

/** Punto da cui misurare le distanze: la posizione concessa o il centro del comune scelto. */
export function puntoDiPartenza(dove: Dove, posizione: Coordinate | null): Coordinate | null {
  if (dove.tipo === 'posizione') return posizione;
  if (dove.tipo === 'comune') {
    const comune = trovaComune(dove.comune);
    return comune ? { lat: comune.lat, lon: comune.lon } : null;
  }
  return null;
}

export type ParametriRicerca = {
  lat: number | null;
  lon: number | null;
  raggioKm: number | null;
  dal: string;
  al: string;
  generi: string[];
  etaMassima: number | null;
  soloAmici: boolean;
};

export function parametriRicerca(
  filtri: Filtri,
  posizione: Coordinate | null,
  oggi: DataCalendario = serataInCorso(),
): ParametriRicerca {
  const [dal, al] = intervallo(filtri.quando, oggi);
  const punto = puntoDiPartenza(filtri.dove, posizione);
  return {
    lat: punto?.lat ?? null,
    lon: punto?.lon ?? null,
    raggioKm: punto ? filtri.distanzaKm : null,
    dal: dataIso(dal),
    al: dataIso(al),
    generi: [...filtri.generi].sort(),
    etaMassima: filtri.etaMassima,
    soloAmici: filtri.soloAmici,
  };
}

// ---------------------------------------------------------------------------------------------
// Filtri ricordati per la durata della scheda del browser (solo sul dispositivo)
// ---------------------------------------------------------------------------------------------

const CHIAVE = 'noxa-filtri-scopri';

export function leggiFiltriSalvati(): Filtri {
  try {
    const testo = window.sessionStorage.getItem(CHIAVE);
    if (!testo) return FILTRI_INIZIALI;
    const esito = SchemaFiltri.safeParse(JSON.parse(testo));
    if (!esito.success) return FILTRI_INIZIALI;
    // Una data scelta che è già passata torna a "stasera".
    const filtri = esito.data;
    if (filtri.quando.tipo === 'data' && dataIso(filtri.quando.data) < dataIso(serataInCorso())) {
      return { ...filtri, quando: { tipo: 'stasera' } };
    }
    return filtri;
  } catch {
    return FILTRI_INIZIALI;
  }
}

export function salvaFiltri(filtri: Filtri): void {
  try {
    window.sessionStorage.setItem(CHIAVE, JSON.stringify(filtri));
  } catch {
    // Senza sessionStorage (navigazione privata) i filtri valgono fino alla chiusura della pagina.
  }
}
