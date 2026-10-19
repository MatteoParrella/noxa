'use client';

import { useCallback, useState } from 'react';
import type { Coordinate } from './filtri';

/**
 * Posizione del telefono per le distanze di Scopri (R-33): si chiede solo dopo il tocco su
 * "Usa la mia posizione", resta in memoria finché la pagina è aperta e viene arrotondata a
 * circa 100 metri prima di qualsiasi uso. Non si salva da nessuna parte.
 */
export type StatoPosizione =
  | { stato: 'inattiva' }
  | { stato: 'attesa' }
  | { stato: 'pronta'; coordinate: Coordinate }
  | { stato: 'negata' }
  | { stato: 'non_disponibile' };

const arrotonda = (valore: number) => Math.round(valore * 1000) / 1000;

let ultimaPosizione: StatoPosizione = { stato: 'inattiva' };

export function usePosizione() {
  const [posizione, setPosizione] = useState<StatoPosizione>(ultimaPosizione);

  const aggiorna = useCallback((nuova: StatoPosizione) => {
    ultimaPosizione = nuova;
    setPosizione(nuova);
  }, []);

  const chiedi = useCallback((): Promise<StatoPosizione> => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      const esito: StatoPosizione = { stato: 'non_disponibile' };
      aggiorna(esito);
      return Promise.resolve(esito);
    }
    aggiorna({ stato: 'attesa' });
    return new Promise((risolvi) => {
      navigator.geolocation.getCurrentPosition(
        (letta) => {
          const esito: StatoPosizione = {
            stato: 'pronta',
            coordinate: {
              lat: arrotonda(letta.coords.latitude),
              lon: arrotonda(letta.coords.longitude),
            },
          };
          aggiorna(esito);
          risolvi(esito);
        },
        (errore) => {
          const esito: StatoPosizione = {
            stato: errore.code === errore.PERMISSION_DENIED ? 'negata' : 'non_disponibile',
          };
          aggiorna(esito);
          risolvi(esito);
        },
        { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
      );
    });
  }, [aggiorna]);

  return { posizione, chiedi };
}
