'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  decidiReclamo,
  esamiReclamo,
  firmaFile,
  firmaFoto,
  leggiCandidati,
  leggiCodaFlyer,
  leggiCodaSegnalazioni,
  leggiContatori,
  leggiDettaglioSegnalazione,
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
  leggiReclamiModerazione,
  leggiRegistro,
  type BucketModerazione,
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
  codaFlyer: ['moderazione', 'coda-flyer'] as const,
  codaSegnalazioni: ['moderazione', 'coda-segnalazioni'] as const,
  segnalazione: (id: string) => ['moderazione', 'segnalazione', id] as const,
  reclamiMod: ['moderazione', 'reclami'] as const,
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

export function useCodaFlyer() {
  return useQuery({ queryKey: CHIAVI.codaFlyer, queryFn: leggiCodaFlyer, refetchInterval: 60_000 });
}

export function useCodaSegnalazioni() {
  return useQuery({
    queryKey: CHIAVI.codaSegnalazioni,
    queryFn: leggiCodaSegnalazioni,
    refetchInterval: 60_000,
  });
}

/**
 * Ogni lettura del dettaglio registra un accesso (R-69): niente riletture automatiche, solo
 * dopo un'azione del moderatore.
 */
export function useDettaglioSegnalazione(id: string | null) {
  return useQuery({
    queryKey: CHIAVI.segnalazione(id ?? ''),
    queryFn: () => leggiDettaglioSegnalazione(id as string),
    enabled: id !== null,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
}

/** URL firmati (un'ora) di immagini private: flyer, foto dei locali e degli eventi, avatar. */
export function useFirme(bucket: BucketModerazione, percorsi: string[]) {
  return useQuery({
    queryKey: [...CHIAVI.tutto, 'firme', bucket, ...percorsi],
    queryFn: () => firmaFile(bucket, percorsi),
    enabled: percorsi.length > 0,
    staleTime: 50 * 60_000,
  });
}

export function useReclamiModerazione() {
  return useQuery({
    queryKey: CHIAVI.reclamiMod,
    queryFn: leggiReclamiModerazione,
    refetchInterval: 60_000,
  });
}

export { decidiReclamo, esamiReclamo };

/** Ora corrente aggiornata ogni mezzo minuto, per i tempi rimanenti delle segnalazioni. */
export function useAdesso(intervallo = 30_000): number {
  const [adesso, setAdesso] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setAdesso(Date.now()), intervallo);
    return () => window.clearInterval(timer);
  }, [intervallo]);
  return adesso;
}
