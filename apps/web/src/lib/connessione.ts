'use client';

import { useSyncExternalStore } from 'react';

function iscrivi(avvisa: () => void) {
  window.addEventListener('online', avvisa);
  window.addEventListener('offline', avvisa);
  return () => {
    window.removeEventListener('online', avvisa);
    window.removeEventListener('offline', avvisa);
  };
}

/** Vero quando il dispositivo ha la connessione; si aggiorna da solo. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    iscrivi,
    () => navigator.onLine,
    () => true,
  );
}

const nessunaIscrizione = () => () => undefined;

/**
 * Vero dopo l'idratazione nel browser: i valori che dipendono dal telefono (data, ora, dati
 * salvati) si leggono solo da lì, così l'export statico non li fissa al momento della build.
 */
export function useMontato(): boolean {
  return useSyncExternalStore(
    nessunaIscrizione,
    () => true,
    () => false,
  );
}
