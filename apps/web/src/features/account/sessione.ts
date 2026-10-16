'use client';

import { useQuery } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { registraErrore } from '@/lib/registro';
import { supabase } from '@/lib/supabase';
import { leggiMioAccount } from './api';
import { cancellaVerificaInAttesa } from './archivio';

export type StatoSessione =
  { stato: 'caricamento' } | { stato: 'assente' } | { stato: 'presente'; utenteId: string };

const CARICAMENTO: StatoSessione = { stato: 'caricamento' };
const ASSENTE: StatoSessione = { stato: 'assente' };

let corrente: StatoSessione = CARICAMENTO;
let avviato = false;
const ascoltatori = new Set<() => void>();

function imposta(utenteId: string | undefined) {
  const prossimo: StatoSessione = utenteId ? { stato: 'presente', utenteId } : ASSENTE;
  if (
    prossimo.stato === corrente.stato &&
    (prossimo.stato !== 'presente' ||
      (corrente.stato === 'presente' && corrente.utenteId === prossimo.utenteId))
  ) {
    return;
  }
  corrente = prossimo;
  // Con una sessione la verifica dell'email è conclusa: niente più dati in attesa sul dispositivo.
  if (utenteId) cancellaVerificaInAttesa();
  for (const ascoltatore of ascoltatori) ascoltatore();
}

function avvia() {
  if (avviato) return;
  avviato = true;
  const client = supabase();
  client.auth
    .getSession()
    .then(({ data }) => imposta(data.session?.user.id))
    .catch((errore: unknown) => {
      registraErrore('lettura della sessione', errore);
      imposta(undefined);
    });
  client.auth.onAuthStateChange((_evento, sessione) => imposta(sessione?.user.id));
}

function iscrivi(ascoltatore: () => void) {
  ascoltatori.add(ascoltatore);
  avvia();
  return () => {
    ascoltatori.delete(ascoltatore);
  };
}

/** Sessione dell'utente su questo dispositivo, aggiornata a ogni accesso o uscita. */
export function useSessione(): StatoSessione {
  return useSyncExternalStore(
    iscrivi,
    () => corrente,
    () => CARICAMENTO,
  );
}

export const CHIAVE_ACCOUNT = 'account';

/** Stato dell'account (RPC mio_account): onboarding, documenti da accettare, fascia. */
export function useMioAccount(sessione: StatoSessione) {
  const utenteId = sessione.stato === 'presente' ? sessione.utenteId : null;
  return useQuery({
    queryKey: [CHIAVE_ACCOUNT, utenteId],
    queryFn: leggiMioAccount,
    enabled: utenteId !== null,
    staleTime: 60_000,
  });
}
