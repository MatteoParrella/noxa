'use client';

import { useEffect, useState } from 'react';
import { ora } from '@/features/scopri/formato';
import { messaggi } from '@/lib/messaggi/it';
import type { RitornoAmico } from './api';
import { POSIZIONE_VECCHIA } from './motore';

const testi = messaggi.ritorno;

/** Ora corrente aggiornata a intervalli: i ritorni cambiano stato con il tempo. */
export function useAdesso(intervallo = 15_000): number {
  const [adesso, setAdesso] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setAdesso(Date.now()), intervallo);
    return () => window.clearInterval(timer);
  }, [intervallo]);
  return adesso;
}

/** "adesso", "3 min fa", "più di un'ora fa". */
export function quantoFa(il: string | number, adesso: number): string {
  const minuti = Math.floor((adesso - new Date(il).getTime()) / 60_000);
  if (minuti < 1) return testi.tempo.adesso;
  if (minuti >= 60) return testi.tempo.oraFa;
  return testi.tempo.minFa(minuti);
}

export function oraDi(il: string | number): string {
  return ora(new Date(il).toISOString());
}

/** La posizione è più vecchia di 5 minuti. */
export function posizioneVecchia(il: string | number | null | undefined, adesso: number): boolean {
  return il === null || il === undefined || adesso - new Date(il).getTime() > POSIZIONE_VECCHIA;
}

/** Metri arrotondati per il testo ("circa 40 m"). */
export function metri(valore: number): number {
  return valore < 100 ? Math.max(5, Math.round(valore / 5) * 5) : Math.round(valore / 10) * 10;
}

export type StatoAmico = 'in_viaggio' | 'in_ritardo' | 'arrivato' | 'terminato';

/** Stato mostrato a chi riceve: il ritardo dipende dall'arrivo previsto, non dalla posizione. */
export function statoAmico(ritorno: RitornoAmico, adesso: number): StatoAmico {
  if (ritorno.stato === 'arrivato') return 'arrivato';
  if (ritorno.stato !== 'attivo') return 'terminato';
  return ritorno.allertaInviataIl || new Date(ritorno.arrivoPrevisto).getTime() < adesso
    ? 'in_ritardo'
    : 'in_viaggio';
}
