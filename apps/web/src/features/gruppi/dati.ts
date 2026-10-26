'use client';

import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useIo } from '@/features/amici/dati';
import { supabase } from '@/lib/supabase';
import {
  amiciInvitabili,
  anteprimaInvito,
  dettaglioGruppo,
  dettaglioSerata,
  eventiAdatti,
  mieiGruppi,
  prossimeSerate,
} from './api';

/** Chiavi della cache: ogni azione sui gruppi invalida `CHIAVI.gruppi`. */
export const CHIAVI = {
  gruppi: ['gruppi'] as const,
  miei: (io: string) => ['gruppi', 'miei', io] as const,
  prossime: (io: string) => ['gruppi', 'prossime', io] as const,
  dettaglio: (io: string, id: string) => ['gruppi', 'dettaglio', io, id] as const,
  anteprima: (io: string, id: string) => ['gruppi', 'anteprima', io, id] as const,
  invitabili: (io: string, gruppo: string | null, selezionati: readonly string[]) =>
    ['gruppi', 'invitabili', io, gruppo ?? '', [...selezionati].sort().join(',')] as const,
  eventi: (io: string, gruppo: string, testo: string) =>
    ['gruppi', 'eventi', io, gruppo, testo] as const,
  serata: (io: string, id: string) => ['gruppi', 'serata', io, id] as const,
};

export function useMieiGruppi() {
  const io = useIo();
  return useQuery({
    queryKey: CHIAVI.miei(io ?? ''),
    queryFn: mieiGruppi,
    enabled: io !== null,
  });
}

export function useProssimeSerate() {
  const io = useIo();
  return useQuery({
    queryKey: CHIAVI.prossime(io ?? ''),
    queryFn: prossimeSerate,
    enabled: io !== null,
  });
}

export function useDettaglioGruppo(id: string | null) {
  const io = useIo();
  return useQuery({
    queryKey: CHIAVI.dettaglio(io ?? '', id ?? ''),
    queryFn: () => dettaglioGruppo(id!),
    enabled: io !== null && id !== null,
  });
}

export function useAnteprimaInvito(id: string | null) {
  const io = useIo();
  return useQuery({
    queryKey: CHIAVI.anteprima(io ?? '', id ?? ''),
    queryFn: () => anteprimaInvito(id!),
    enabled: io !== null && id !== null,
  });
}

/** Amici invitabili: si ricalcola a ogni selezione, mostrando intanto il risultato precedente. */
export function useAmiciInvitabili(gruppo: string | null, selezionati: readonly string[]) {
  const io = useIo();
  return useQuery({
    queryKey: CHIAVI.invitabili(io ?? '', gruppo, selezionati),
    queryFn: () => amiciInvitabili(gruppo, selezionati),
    enabled: io !== null,
    placeholderData: keepPreviousData,
  });
}

export function useEventiAdatti(gruppo: string | null, testo: string) {
  const io = useIo();
  return useQuery({
    queryKey: CHIAVI.eventi(io ?? '', gruppo ?? '', testo),
    queryFn: () => eventiAdatti(gruppo!, testo),
    enabled: io !== null && gruppo !== null,
    placeholderData: keepPreviousData,
  });
}

/**
 * Dettaglio della serata con l'aggiornamento dal vivo (ARCHITECTURE.md §4.3): ogni modifica
 * a risposte o serata, filtrata dalla RLS, ricarica il dettaglio.
 */
export function useDettaglioSerata(id: string | null) {
  const io = useIo();
  const client = useQueryClient();

  useEffect(() => {
    if (!io || !id) return;
    const ricarica = () => void client.invalidateQueries({ queryKey: CHIAVI.serata(io, id) });
    const canale = supabase()
      .channel(`serata-${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'partecipazioni_serata',
          filter: `serata_id=eq.${id}`,
        },
        ricarica,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'serate_gruppo', filter: `id=eq.${id}` },
        ricarica,
      )
      .subscribe();
    return () => {
      void supabase().removeChannel(canale);
    };
  }, [io, id, client]);

  return useQuery({
    queryKey: CHIAVI.serata(io ?? '', id ?? ''),
    queryFn: () => dettaglioSerata(id!),
    enabled: io !== null && id !== null,
  });
}

/** Inviti, ingressi e uscite dai gruppi arrivano dal vivo: si ricaricano gruppi e serate. */
export function useGruppiDalVivo() {
  const io = useIo();
  const client = useQueryClient();
  useEffect(() => {
    if (!io) return;
    const canale = supabase()
      .channel(`gruppi-${io}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'membri_gruppo', filter: `utente_id=eq.${io}` },
        () => void client.invalidateQueries({ queryKey: CHIAVI.gruppi }),
      )
      .subscribe();
    return () => {
      void supabase().removeChannel(canale);
    };
  }, [io, client]);
}
