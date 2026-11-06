'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useSyncExternalStore } from 'react';
import { useIo } from '@/features/amici/dati';
import { ascoltaAvvisi } from '@/lib/avvisi';
import { leggiRitorni, leggiSuggerimentiRitorno, type MioRitorno, type RitornoAmico } from './api';
import { EVENTO_AREE, leggiAree, leggiSessioneLocale, type AreaArrivo } from './dispositivo';

/**
 * Chiavi della cache sotto `vivi`: gli avvisi del canale `vivi:<io>` (useAvvisiVivi) ricaricano
 * anche i ritorni.
 */
export const CHIAVI_RITORNO = {
  tutti: ['vivi', 'ritorni'] as const,
  ritorni: (io: string) => ['vivi', 'ritorni', io] as const,
  suggerimenti: (io: string) => ['vivi', 'ritorni', 'suggerimenti', io] as const,
};

/** Allerta e fine arrivano dal server ogni minuto: senza avvisi si ricontrolla ogni minuto. */
const OGNI_MINUTO = 60_000;

export function useRitorni() {
  const io = useIo();
  return useQuery({
    queryKey: CHIAVI_RITORNO.ritorni(io ?? ''),
    queryFn: leggiRitorni,
    enabled: io !== null,
    refetchInterval: OGNI_MINUTO,
  });
}

export function useSuggerimentiRitorno(attivo: boolean) {
  const io = useIo();
  return useQuery({
    queryKey: CHIAVI_RITORNO.suggerimenti(io ?? ''),
    queryFn: leggiSuggerimentiRitorno,
    enabled: io !== null && attivo,
  });
}

/**
 * Avvisi senza dati sul canale privato `ritorno:<id>` (ADR-0028): una posizione nuova, una
 * proroga o la fine. Chi guarda ricarica con la RLS.
 */
export function useAvvisiRitorno(id: string | null) {
  const client = useQueryClient();
  useEffect(() => {
    if (!id) return;
    return ascoltaAvvisi(
      `ritorno:${id}`,
      () => void client.invalidateQueries({ queryKey: CHIAVI_RITORNO.tutti }),
    );
  }, [id, client]);
}

/** Il ritorno di un amico tra quelli ricevuti, o null se non è (più) visibile. */
export function trovaRicevuto(ricevuti: RitornoAmico[] | undefined, id: string | null) {
  return ricevuti?.find((ritorno) => ritorno.id === id) ?? null;
}

/** Aree di arrivo salvate su questo telefono, aggiornate quando cambiano (R-32). */
export function useAreeArrivo(): AreaArrivo[] {
  return useSyncExternalStore(
    (avvisa) => {
      window.addEventListener(EVENTO_AREE, avvisa);
      window.addEventListener('storage', avvisa);
      return () => {
        window.removeEventListener(EVENTO_AREE, avvisa);
        window.removeEventListener('storage', avvisa);
      };
    },
    leggiAreeMemo,
    () => VUOTO,
  );
}

const VUOTO: AreaArrivo[] = [];
let ultimeAree: { testo: string; aree: AreaArrivo[] } = { testo: '[]', aree: VUOTO };
/** useSyncExternalStore vuole lo stesso oggetto finché i dati non cambiano. */
function leggiAreeMemo(): AreaArrivo[] {
  const aree = leggiAree();
  const testo = JSON.stringify(aree);
  if (testo !== ultimeAree.testo) ultimeAree = { testo, aree };
  return ultimeAree.aree;
}

/** Il ritorno è stato avviato su questo telefono (solo qui si condivide la posizione). */
export function avviatoQui(mio: MioRitorno | null): boolean {
  return mio !== null && leggiSessioneLocale()?.ritornoId === mio.id;
}

/** "Binario 7 → Casa": partenza dal check-in o dalla serata, arrivo dall'area scelta. */
export function trattaLocale(mio: MioRitorno, aree: AreaArrivo[], casa: string) {
  const sessione = leggiSessioneLocale();
  const qui = sessione?.ritornoId === mio.id ? sessione : null;
  const area = aree.find((a) => a.id === qui?.areaId);
  return { partenza: qui?.partenza ?? null, arrivo: area?.nome ?? casa };
}
