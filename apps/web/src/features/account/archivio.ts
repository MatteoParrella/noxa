'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { z } from 'zod';

/**
 * Registrazione in attesa di verifica, salvata solo su questo dispositivo: serve a mostrare
 * l'indirizzo mascherato, a reinviare l'email e a rispettare l'attesa di 60 secondi. Si
 * cancella alla prima sessione (sessione.ts).
 */
const CHIAVE = 'noxa-verifica-email';
const EVENTO = 'noxa:verifica-email';

const SchemaInAttesa = z.object({ email: z.email(), inviataIl: z.number() });
export type VerificaInAttesa = z.infer<typeof SchemaInAttesa>;

function leggiGrezzo(): string | null {
  try {
    return window.localStorage.getItem(CHIAVE);
  } catch {
    return null;
  }
}

function analizza(grezzo: string | null): VerificaInAttesa | null {
  if (!grezzo) return null;
  try {
    const esito = SchemaInAttesa.safeParse(JSON.parse(grezzo));
    return esito.success ? esito.data : null;
  } catch {
    return null;
  }
}

export function leggiVerificaInAttesa(): VerificaInAttesa | null {
  return analizza(leggiGrezzo());
}

function avvisa() {
  window.dispatchEvent(new Event(EVENTO));
}

export function salvaVerificaInAttesa(dati: VerificaInAttesa): void {
  try {
    window.localStorage.setItem(CHIAVE, JSON.stringify(dati));
  } catch {
    // Archiviazione non disponibile: la schermata chiede l'email se serve reinviare.
  }
  avvisa();
}

export function cancellaVerificaInAttesa(): void {
  try {
    window.localStorage.removeItem(CHIAVE);
  } catch {
    // Niente da cancellare.
  }
  avvisa();
}

function iscrivi(aggiorna: () => void) {
  window.addEventListener(EVENTO, aggiorna);
  window.addEventListener('storage', aggiorna);
  return () => {
    window.removeEventListener(EVENTO, aggiorna);
    window.removeEventListener('storage', aggiorna);
  };
}

/**
 * Verifica in attesa sul dispositivo. `undefined` finché la pagina non è nel browser (export
 * statico), poi i dati salvati oppure `null`.
 */
export function useVerificaInAttesa(): VerificaInAttesa | null | undefined {
  const grezzo = useSyncExternalStore<string | null | undefined>(
    iscrivi,
    leggiGrezzo,
    () => undefined,
  );
  return useMemo(() => (grezzo === undefined ? undefined : analizza(grezzo)), [grezzo]);
}
