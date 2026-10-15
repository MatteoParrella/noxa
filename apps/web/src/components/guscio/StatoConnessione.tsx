'use client';

import { useSyncExternalStore } from 'react';
import { StrisciaOffline } from '@/components/ui/Stati';

function iscrivi(avvisa: () => void) {
  window.addEventListener('online', avvisa);
  window.addEventListener('offline', avvisa);
  return () => {
    window.removeEventListener('online', avvisa);
    window.removeEventListener('offline', avvisa);
  };
}

/** Mostra la striscia offline quando il dispositivo perde la connessione. */
export function StatoConnessione() {
  const online = useSyncExternalStore(
    iscrivi,
    () => navigator.onLine,
    () => true,
  );
  return online ? null : <StrisciaOffline />;
}
