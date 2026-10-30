'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { useIo } from '@/features/amici/dati';
import { useOnline } from '@/lib/connessione';
import { ErroreRete, converti } from '@/lib/errori';
import {
  categorieDisponibili,
  cercaDove,
  eliminaSerata,
  leggiDiario,
  salvaSerata,
  type Salvataggio,
  type Voce,
} from './api';
import {
  accoda,
  leggiCoda,
  sincronizza,
  togliDallaCoda,
  unisciDiario,
  type VoceMostrata,
} from './coda';

/** Chiavi della cache: ogni scrittura invalida `CHIAVI.diario`. */
export const CHIAVI = {
  diario: ['diario'] as const,
  server: (io: string) => ['diario', 'voci', io] as const,
  coda: (io: string) => ['diario', 'coda', io] as const,
  categorie: (io: string) => ['diario', 'categorie', io] as const,
  cerca: (io: string, testo: string) => ['diario', 'cerca', io, testo] as const,
};

export type StatoDiario =
  | { stato: 'caricamento' }
  | { stato: 'errore'; riprova: () => void; inCorso: boolean }
  | { stato: 'pronto'; voci: VoceMostrata[] };

/**
 * Diario mostrato: le serate del server (salvate anche in IndexedDB per l'offline) con sopra
 * quelle in attesa di sincronizzazione. Senza rete e senza copia salvata si vede almeno la coda.
 */
export function useDiario(): StatoDiario {
  const io = useIo();
  const online = useOnline();
  const server = useQuery({
    queryKey: CHIAVI.server(io ?? ''),
    queryFn: leggiDiario,
    enabled: io !== null,
  });
  const coda = useQuery({
    queryKey: CHIAVI.coda(io ?? ''),
    queryFn: () => leggiCoda(io!),
    enabled: io !== null,
    networkMode: 'always',
    staleTime: Infinity,
  });

  return useMemo<StatoDiario>(() => {
    if (coda.isPending) return { stato: 'caricamento' };
    const inAttesa = coda.data ?? [];
    if (server.data) return { stato: 'pronto', voci: unisciDiario(server.data, inAttesa) };
    if (!online) return { stato: 'pronto', voci: unisciDiario([], inAttesa) };
    if (server.isError) {
      return { stato: 'errore', riprova: () => void server.refetch(), inCorso: server.isFetching };
    }
    return { stato: 'caricamento' };
  }, [coda.isPending, coda.data, server, online]);
}

/** Una serata del diario (anche in attesa di sincronizzazione), o null se non c'è. */
export function useVoce(
  id: string | null,
): StatoDiario | { stato: 'voce'; voce: VoceMostrata | null } {
  const diario = useDiario();
  if (diario.stato !== 'pronto') return diario;
  return { stato: 'voce', voce: diario.voci.find((voce) => voce.id === id) ?? null };
}

export function useCategorieSpesa() {
  const io = useIo();
  return useQuery({
    queryKey: CHIAVI.categorie(io ?? ''),
    queryFn: categorieDisponibili,
    enabled: io !== null,
    staleTime: 60 * 60 * 1000,
  });
}

export function useCercaDove(testo: string) {
  const io = useIo();
  const pulito = testo.trim();
  return useQuery({
    queryKey: CHIAVI.cerca(io ?? '', pulito),
    queryFn: () => cercaDove(pulito),
    enabled: io !== null && pulito.length >= 2,
    placeholderData: keepPreviousData,
  });
}

export type EsitoScrittura = { offline: boolean };

/**
 * Salva una serata: con la rete subito nel database, senza (o se la rete cade durante
 * l'invio) nella coda del dispositivo, che parte al ritorno della connessione. Un rifiuto del
 * database arriva al modulo come errore da correggere.
 */
export function useSalvaSerata() {
  const io = useIo();
  const client = useQueryClient();
  return useMutation({
    // La rete la gestisce la funzione: senza, la scrittura va nella coda del dispositivo.
    networkMode: 'always',
    mutationFn: async ({
      dati,
      anteprima,
    }: {
      dati: Salvataggio;
      anteprima: Voce;
    }): Promise<EsitoScrittura> => {
      if (!io) throw new ErroreRete('sessione');
      const inCoda = async () => {
        await accoda(io, {
          tipo: 'salva',
          id: dati.id,
          dati,
          anteprima,
          modificata_il: new Date().toISOString(),
          errore: false,
        });
        return { offline: true };
      };
      if (!navigator.onLine) return inCoda();
      try {
        await salvaSerata(dati);
      } catch (errore) {
        if (converti(errore) instanceof ErroreRete) return inCoda();
        throw converti(errore);
      }
      // Una versione precedente rimasta in coda (per esempio rifiutata) non serve più.
      await togliDallaCoda(io, dati.id);
      return { offline: false };
    },
    onSettled: () => void client.invalidateQueries({ queryKey: CHIAVI.diario }),
  });
}

/** Elimina una serata, anche senza rete; una serata mai sincronizzata sparisce e basta. */
export function useEliminaSerata() {
  const io = useIo();
  const client = useQueryClient();
  return useMutation({
    // La rete la gestisce la funzione: senza, la scrittura va nella coda del dispositivo.
    networkMode: 'always',
    mutationFn: async (voce: VoceMostrata): Promise<EsitoScrittura> => {
      if (!io) throw new ErroreRete('sessione');
      const soloLocale =
        voce.stato !== 'sincronizzata' &&
        !(client.getQueryData<Voce[]>(CHIAVI.server(io)) ?? []).some((v) => v.id === voce.id);
      const inCoda = async () => {
        await accoda(
          io,
          { tipo: 'elimina', id: voce.id, modificata_il: new Date().toISOString(), errore: false },
          { soloLocale },
        );
        return { offline: true };
      };
      if (soloLocale || !navigator.onLine) return inCoda();
      try {
        await eliminaSerata(voce.id);
      } catch (errore) {
        if (converti(errore) instanceof ErroreRete) return inCoda();
        throw converti(errore);
      }
      await togliDallaCoda(io, voce.id);
      return { offline: false };
    },
    onSettled: () => void client.invalidateQueries({ queryKey: CHIAVI.diario }),
  });
}

/**
 * Invia la coda del diario all'apertura dell'app e a ogni ritorno della connessione. Si monta
 * una volta nel guscio delle aree.
 */
export function useSincronizzaDiario(onInviate?: (numero: number) => void) {
  const io = useIo();
  const online = useOnline();
  const client = useQueryClient();
  useEffect(() => {
    if (!io || !online) return;
    let annullato = false;
    void sincronizza(io, { salva: salvaSerata, elimina: eliminaSerata }).then((esito) => {
      if (annullato) return;
      if (esito.inviate > 0 || esito.inErrore > 0) {
        void client.invalidateQueries({ queryKey: CHIAVI.diario });
      }
      if (esito.inviate > 0) onInviate?.(esito.inviate);
    });
    return () => {
      annullato = true;
    };
  }, [io, online, client, onInviate]);
}
