'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { ErroreRete } from '@/lib/errori';

/** Cache dei dati (TanStack Query): retry automatico solo delle letture e solo senza rete. */
export function Fornitori({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: (tentativi, errore) => errore instanceof ErroreRete && tentativi < 3,
            refetchOnWindowFocus: false,
          },
          mutations: { retry: false },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
