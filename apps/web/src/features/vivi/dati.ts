'use client';

import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useIo } from '@/features/amici/dati';
import { ascoltaAvvisi } from '@/lib/avvisi';
import {
  cercaLocali,
  leggiCheckinAbilitato,
  leggiCheckinAmici,
  leggiCheckinRicevuto,
  leggiMioCheckin,
  leggiSuggerimenti,
} from './api';

/** Chiavi della cache: ogni azione sul check-in invalida `CHIAVI.vivi`. */
export const CHIAVI = {
  vivi: ['vivi'] as const,
  abilitato: (io: string) => ['vivi', 'abilitato', io] as const,
  mio: (io: string) => ['vivi', 'mio', io] as const,
  amici: (io: string) => ['vivi', 'amici', io] as const,
  ricevuto: (io: string, id: string) => ['vivi', 'ricevuto', io, id] as const,
  suggerimenti: (io: string) => ['vivi', 'suggerimenti', io] as const,
  locali: (testo: string) => ['vivi', 'locali', testo] as const,
};

// Un check-in scade da solo dopo 6 ore: senza avvisi la pagina si ricontrolla ogni minuto.
const OGNI_MINUTO = 60_000;

/**
 * Aggiornamenti dal vivo dell'area Vivi: un check-in ricevuto, terminato o da cui sei stato
 * tolto arriva come avviso senza dati sul canale privato `vivi:<io>` (ADR-0024) e ricarica.
 */
export function useAvvisiVivi() {
  const io = useIo();
  const client = useQueryClient();
  useEffect(() => {
    if (!io) return;
    return ascoltaAvvisi(
      `vivi:${io}`,
      () => void client.invalidateQueries({ queryKey: CHIAVI.vivi }),
    );
  }, [io, client]);
}

export function useCheckinAbilitato() {
  const io = useIo();
  return useQuery({
    queryKey: CHIAVI.abilitato(io ?? ''),
    queryFn: () => leggiCheckinAbilitato(io!),
    enabled: io !== null,
  });
}

export function useMioCheckin() {
  const io = useIo();
  return useQuery({
    queryKey: CHIAVI.mio(io ?? ''),
    queryFn: () => leggiMioCheckin(io!),
    enabled: io !== null,
    refetchInterval: OGNI_MINUTO,
  });
}

export function useCheckinAmici() {
  const io = useIo();
  return useQuery({
    queryKey: CHIAVI.amici(io ?? ''),
    queryFn: () => leggiCheckinAmici(io!),
    enabled: io !== null,
    refetchInterval: OGNI_MINUTO,
  });
}

export function useCheckinRicevuto(id: string | null) {
  const io = useIo();
  return useQuery({
    queryKey: CHIAVI.ricevuto(io ?? '', id ?? ''),
    queryFn: () => leggiCheckinRicevuto(id!),
    enabled: io !== null && id !== null,
  });
}

export function useSuggerimenti(attivo: boolean) {
  const io = useIo();
  return useQuery({
    queryKey: CHIAVI.suggerimenti(io ?? ''),
    queryFn: leggiSuggerimenti,
    enabled: io !== null && attivo,
  });
}

export function useCercaLocali(testo: string) {
  const pulito = testo.trim();
  return useQuery({
    queryKey: CHIAVI.locali(pulito.toLocaleLowerCase('it')),
    queryFn: () => cercaLocali(pulito),
    enabled: pulito.length >= 2,
    placeholderData: keepPreviousData,
  });
}
