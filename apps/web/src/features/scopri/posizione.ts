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

/** Attesa massima di una risposta, popup del permesso compreso. */
const ATTESA_MASSIMA_MS = 30_000;

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
      let chiusa = false;
      const chiudi = (esito: StatoPosizione) => {
        if (chiusa) return;
        chiusa = true;
        window.clearTimeout(limite);
        aggiorna(esito);
        risolvi(esito);
      };
      // Il `timeout` del browser parte solo dopo il permesso: se la richiesta resta aperta (su
      // Firefox chiudendo il popup senza scegliere) si torna comunque a tutta l'area.
      const limite = window.setTimeout(
        () => chiudi({ stato: 'non_disponibile' }),
        ATTESA_MASSIMA_MS,
      );
      navigator.geolocation.getCurrentPosition(
        (letta) =>
          chiudi({
            stato: 'pronta',
            coordinate: {
              lat: arrotonda(letta.coords.latitude),
              lon: arrotonda(letta.coords.longitude),
            },
          }),
        (errore) =>
          chiudi({
            stato: errore.code === errore.PERMISSION_DENIED ? 'negata' : 'non_disponibile',
          }),
        { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
      );
    });
  }, [aggiorna]);

  return { posizione, chiedi };
}
