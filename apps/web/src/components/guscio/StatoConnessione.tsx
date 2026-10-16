'use client';

import { StrisciaOffline } from '@/components/ui/Stati';
import { useOnline } from '@/lib/connessione';

/** Mostra la striscia offline quando il dispositivo perde la connessione. */
export function StatoConnessione({ testo }: { testo?: string }) {
  const online = useOnline();
  if (online) return null;
  return testo ? <StrisciaOffline testo={testo} /> : <StrisciaOffline />;
}
