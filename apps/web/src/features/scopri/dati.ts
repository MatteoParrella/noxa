'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useIo } from '@/features/amici/dati';
import {
  cercaEventi,
  dettaglioEvento,
  DURATA_LINK_SECONDI,
  firmaCopertine,
  leggiGeneri,
  visibilitaPredefinita,
  type Copertina,
} from './api';
import type { ParametriRicerca } from './filtri';

/** Chiavi della cache: una scelta di partecipazione invalida `CHIAVI.eventi`. */
export const CHIAVI = {
  eventi: ['eventi'] as const,
  ricerca: (io: string, parametri: ParametriRicerca) =>
    ['eventi', 'ricerca', io, parametri] as const,
  dettaglio: (io: string, id: string) => ['eventi', 'dettaglio', io, id] as const,
  visibilita: (io: string) => ['eventi', 'visibilita', io] as const,
  copertine: (percorsi: string[]) => ['copertine', percorsi] as const,
  generi: ['generi'] as const,
};

export function useEventi(parametri: ParametriRicerca | null) {
  const io = useIo();
  return useQuery({
    queryKey: CHIAVI.ricerca(io ?? '', parametri!),
    queryFn: () => cercaEventi(parametri!),
    enabled: io !== null && parametri !== null,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export function useEvento(id: string | null) {
  const io = useIo();
  return useQuery({
    queryKey: CHIAVI.dettaglio(io ?? '', id ?? ''),
    queryFn: () => dettaglioEvento(id!),
    enabled: io !== null && id !== null,
    staleTime: 60_000,
  });
}

export function useVisibilitaPredefinita() {
  const io = useIo();
  return useQuery({
    queryKey: CHIAVI.visibilita(io ?? ''),
    queryFn: () => visibilitaPredefinita(io!),
    enabled: io !== null,
    staleTime: 5 * 60_000,
  });
}

/** Link firmati delle copertine, rinnovati prima che scadano. */
export function useCopertine(copertine: Copertina[]) {
  const percorsi = [
    ...new Set(
      copertine
        .filter((copertina) => copertina.tipo !== 'tipografica' && copertina.path)
        .map((copertina) => `${copertina.tipo}:${copertina.path}`),
    ),
  ].sort();
  return useQuery({
    queryKey: CHIAVI.copertine(percorsi),
    queryFn: () => firmaCopertine(copertine),
    enabled: percorsi.length > 0,
    staleTime: (DURATA_LINK_SECONDI - 300) * 1000,
    gcTime: (DURATA_LINK_SECONDI - 60) * 1000,
  });
}

/** Generi musicali (elenco chiuso, cambia solo con le migrazioni). */
export function useGeneri() {
  const io = useIo();
  return useQuery({
    queryKey: CHIAVI.generi,
    queryFn: leggiGeneri,
    enabled: io !== null,
    staleTime: Infinity,
  });
}

/** Nome leggibile di un genere: dal database, oppure dal codice ("hip_hop" → "hip hop"). */
export function useNomiGeneri(): Record<string, string> {
  const generi = useGeneri();
  return Object.fromEntries((generi.data ?? []).map((genere) => [genere.codice, genere.nome]));
}

export const nomeGenere = (nomi: Record<string, string>, codice: string) =>
  nomi[codice] ?? codice.replaceAll('_', ' ');
