'use client';

import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useState, type ReactNode } from 'react';
import { FornitoreToast } from '@/components/ui/Toast';
import { DURATA_CACHE_MS, daSalvare, persistenza } from '@/lib/cacheLocale';
import { ErroreRete } from '@/lib/errori';

/**
 * Cache dei dati (TanStack Query): retry automatico solo delle letture e solo senza rete. Le
 * letture delle aree consultabili offline restano in IndexedDB (lib/cacheLocale.ts).
 */
export function Fornitori({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: (tentativi, errore) => errore instanceof ErroreRete && tentativi < 3,
            refetchOnWindowFocus: false,
            // Una lettura salvata deve sopravvivere in memoria quanto sul dispositivo.
            gcTime: DURATA_CACHE_MS,
          },
          mutations: { retry: false },
        },
      }),
  );
  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{
        persister: persistenza,
        maxAge: DURATA_CACHE_MS,
        buster: process.env.NEXT_PUBLIC_VERSIONE_APP ?? '',
        dehydrateOptions: { shouldDehydrateQuery: daSalvare },
      }}
    >
      <FornitoreToast>{children}</FornitoreToast>
    </PersistQueryClientProvider>
  );
}
