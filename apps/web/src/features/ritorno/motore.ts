'use client';

import { useSyncExternalStore } from 'react';
import type { Coordinate } from './api';
import type { ErrorePosizione } from './posizione';

/**
 * Stato della condivisione sul telefono che ha avviato il ritorno: ultima posizione letta, ultimo
 * invio riuscito, errori del GPS e arrivo automatico in attesa. Vive solo in memoria.
 */
export type StatoMotore = {
  ritornoId: string | null;
  ultima: (Coordinate & { il: number }) | null;
  inviataIl: number | null;
  errore: ErrorePosizione | null;
  /** Arrivo nell'area rilevato: il ritorno si conclude a `scadenza` se non lo riprendi. */
  arrivoInAttesa: { area: string; scadenza: number } | null;
  /** "Non ero arrivato": l'arrivo automatico resta spento finché non esci dall'area. */
  areaIgnorata: boolean;
  /** Promemoria "mancano 10 minuti" chiuso per questo arrivo previsto. */
  promemoriaChiuso: string | null;
};

const INIZIALE: StatoMotore = {
  ritornoId: null,
  ultima: null,
  inviataIl: null,
  errore: null,
  arrivoInAttesa: null,
  areaIgnorata: false,
  promemoriaChiuso: null,
};

let stato: StatoMotore = INIZIALE;
const ascoltatori = new Set<() => void>();

export function leggiMotore(): StatoMotore {
  return stato;
}

export function aggiornaMotore(modifica: Partial<StatoMotore>): void {
  stato = { ...stato, ...modifica };
  for (const avvisa of ascoltatori) avvisa();
}

export function azzeraMotore(ritornoId: string | null = null): void {
  stato = { ...INIZIALE, ritornoId };
  for (const avvisa of ascoltatori) avvisa();
}

export function useMotore(): StatoMotore {
  return useSyncExternalStore(
    (avvisa) => {
      ascoltatori.add(avvisa);
      return () => ascoltatori.delete(avvisa);
    },
    () => stato,
    () => INIZIALE,
  );
}

/** Intervallo minimo tra due invii, come il limite del database (R-31). */
export const INTERVALLO_INVIO = 30_000;
/** Dopo 5 minuti senza posizioni gli amici vedono un orario vecchio (design §4). */
export const POSIZIONE_VECCHIA = 5 * 60_000;
/** Il promemoria compare 10 minuti prima dell'arrivo previsto. */
export const ANTICIPO_PROMEMORIA = 10 * 60_000;
/** "Non ero arrivato" si può toccare per un minuto. */
export const ATTESA_ARRIVO = 60_000;
/** Oltre questa precisione la posizione si dice imprecisa (design §3). */
export const PRECISIONE_SCARSA = 200;
