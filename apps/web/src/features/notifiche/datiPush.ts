'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useIo } from '@/features/amici/dati';
import { registraErrore } from '@/lib/registro';
import { leggiDispositivi, rinnovaDispositivo, statoPush, type StatoPush } from './push';

/** Chiavi della cache: attivare o togliere un dispositivo invalida `CHIAVI_PUSH.push`. */
export const CHIAVI_PUSH = {
  push: ['push'] as const,
  dispositivi: (io: string) => ['push', 'dispositivi', io] as const,
};

export function useDispositivi() {
  const io = useIo();
  return useQuery({
    queryKey: CHIAVI_PUSH.dispositivi(io ?? ''),
    queryFn: leggiDispositivi,
    enabled: io !== null,
  });
}

/**
 * Stato del permesso su questo dispositivo, riletto quando si torna sull'app: il permesso si
 * cambia dalle impostazioni del browser o del telefono.
 */
export function useStatoPush(): StatoPush | null {
  const [stato, setStato] = useState<StatoPush | null>(null);
  useEffect(() => {
    const aggiorna = () => setStato(statoPush());
    aggiorna();
    document.addEventListener('visibilitychange', aggiorna);
    return () => document.removeEventListener('visibilitychange', aggiorna);
  }, []);
  return stato;
}

/** Una volta per apertura dell'app, con la sessione presente, rinnova il dispositivo. */
export function useRinnovaDispositivo() {
  const io = useIo();
  useEffect(() => {
    if (!io) return;
    rinnovaDispositivo().catch((errore: unknown) => registraErrore('rinnovo dispositivo', errore));
  }, [io]);
}

const CHIAVE_INVITO_NASCOSTO = 'noxa-push-invito-nascosto';
const CHIAVE_SUGGERITO = 'noxa-push-suggerito';

function leggiFlag(chiave: string): boolean {
  try {
    return window.localStorage.getItem(chiave) === '1';
  } catch {
    return false;
  }
}

function scriviFlag(chiave: string): void {
  try {
    window.localStorage.setItem(chiave, '1');
  } catch (errore) {
    registraErrore('preferenza notifiche', errore);
  }
}

/** "Non mostrare più" della riga in fondo all'elenco delle notifiche. */
export const invitoNascosto = () => leggiFlag(CHIAVE_INVITO_NASCOSTO);
export const nascondiInvito = () => scriviFlag(CHIAVE_INVITO_NASCOSTO);
/** Il suggerimento nel foglio dell'esito compare una volta sola (design/F-22-notifiche §1). */
export const giaSuggerito = () => leggiFlag(CHIAVE_SUGGERITO);
export const segnaSuggerito = () => scriviFlag(CHIAVE_SUGGERITO);
