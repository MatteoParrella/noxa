'use client';

import { useQuery } from '@tanstack/react-query';
import {
  firmaFoto,
  leggiCandidati,
  leggiContatori,
  leggiDuplicati,
  leggiEsecuzioni,
  leggiEvento,
  leggiEventi,
  leggiFonte,
  leggiFonti,
  leggiGeneri,
  leggiLocale,
  leggiLocali,
  leggiPossibiliAnnullamenti,
  leggiRegistro,
  type FiltriEventi,
  type TipoRegistro,
} from './api';

/** Chiavi delle query dell'area: le azioni invalidano quelle che cambiano. */
export const CHIAVI = {
  tutto: ['moderazione'] as const,
  contatori: ['moderazione', 'contatori'] as const,
  locali: ['moderazione', 'locali'] as const,
  locale: (id: string) => ['moderazione', 'locale', id] as const,
  candidati: ['moderazione', 'candidati'] as const,
  fonti: ['moderazione', 'fonti'] as const,
  fonte: (id: string) => ['moderazione', 'fonte', id] as const,
  esecuzioni: (id: string) => ['moderazione', 'esecuzioni', id] as const,
  duplicati: ['moderazione', 'duplicati'] as const,
  eventi: ['moderazione', 'eventi'] as const,
  evento: (id: string) => ['moderazione', 'evento', id] as const,
  annullamenti: ['moderazione', 'annullamenti'] as const,
  registro: (tipo: TipoRegistro, id: string) => ['moderazione', 'registro', tipo, id] as const,
  foto: (percorsi: string[]) => ['moderazione', 'foto', ...percorsi] as const,
  generi: ['moderazione', 'generi'] as const,
};

export function useContatori() {
  return useQuery({ queryKey: CHIAVI.contatori, queryFn: leggiContatori, refetchInterval: 60_000 });
}

export function useLocali() {
  return useQuery({ queryKey: CHIAVI.locali, queryFn: leggiLocali });
}

export function useLocale(id: string | null) {
  return useQuery({
    queryKey: CHIAVI.locale(id ?? ''),
    queryFn: () => leggiLocale(id as string),
    enabled: id !== null,
  });
}

export function useCandidati() {
  return useQuery({ queryKey: CHIAVI.candidati, queryFn: leggiCandidati });
}

export function useFonti() {
  return useQuery({ queryKey: CHIAVI.fonti, queryFn: () => leggiFonti() });
}

export function useFontiLocale(locale: string | null) {
  return useQuery({
    queryKey: [...CHIAVI.fonti, 'locale', locale ?? ''],
    queryFn: () => leggiFonti(locale as string),
    enabled: locale !== null,
  });
}

export function useFonte(id: string | null) {
  return useQuery({
    queryKey: CHIAVI.fonte(id ?? ''),
    queryFn: () => leggiFonte(id as string),
    enabled: id !== null,
  });
}

export function useEsecuzioni(id: string | null) {
  return useQuery({
    queryKey: CHIAVI.esecuzioni(id ?? ''),
    queryFn: () => leggiEsecuzioni(id as string),
    enabled: id !== null,
  });
}

export function useDuplicati() {
  return useQuery({ queryKey: CHIAVI.duplicati, queryFn: leggiDuplicati });
}

export function useEventi(filtri: FiltriEventi) {
  return useQuery({
    queryKey: [...CHIAVI.eventi, filtri],
    queryFn: () => leggiEventi(filtri),
    placeholderData: (precedenti) => precedenti,
  });
}

export function useEvento(id: string | null) {
  return useQuery({
    queryKey: CHIAVI.evento(id ?? ''),
    queryFn: () => leggiEvento(id as string),
    enabled: id !== null,
  });
}

export function usePossibiliAnnullamenti() {
  return useQuery({ queryKey: CHIAVI.annullamenti, queryFn: leggiPossibiliAnnullamenti });
}

export function useRegistro(tipo: TipoRegistro, id: string | null) {
  return useQuery({
    queryKey: CHIAVI.registro(tipo, id ?? ''),
    queryFn: () => leggiRegistro(tipo, id as string),
    enabled: id !== null,
  });
}

/** URL firmati delle foto dei locali, rinnovati prima della scadenza di un'ora. */
export function useFotoFirmate(percorsi: string[]) {
  return useQuery({
    queryKey: CHIAVI.foto(percorsi),
    queryFn: () => firmaFoto(percorsi),
    enabled: percorsi.length > 0,
    staleTime: 50 * 60_000,
  });
}

export function useGeneri() {
  return useQuery({ queryKey: CHIAVI.generi, queryFn: leggiGeneri, staleTime: Infinity });
}
