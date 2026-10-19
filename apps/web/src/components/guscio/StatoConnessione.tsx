'use client';

import { usePathname } from 'next/navigation';
import { StrisciaOffline } from '@/components/ui/Stati';
import { useOnline } from '@/lib/connessione';
import { messaggi } from '@/lib/messaggi/it';

/** Testi della striscia per le pagine che hanno un messaggio proprio (design/F-01-scopri). */
const TESTI_PER_PAGINA: Record<string, string> = {
  '/scopri/': messaggi.scopri.offline,
  '/evento/': messaggi.evento.offline,
};

/** Mostra la striscia offline quando il dispositivo perde la connessione. */
export function StatoConnessione({ testo }: { testo?: string }) {
  const online = useOnline();
  const percorso = usePathname();
  if (online) return null;
  const scelto = testo ?? TESTI_PER_PAGINA[percorso.endsWith('/') ? percorso : `${percorso}/`];
  return scelto ? <StrisciaOffline testo={scelto} /> : <StrisciaOffline />;
}
