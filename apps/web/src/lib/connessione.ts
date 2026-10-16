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
