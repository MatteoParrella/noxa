import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ConfermaEmail } from '@/features/account/ConfermaEmail';

export const metadata: Metadata = { title: 'Conferma dell’email · Noxa' };

/** Il token arriva nei parametri della pagina: con l'export statico si legge nel browser. */
export default function PaginaConferma() {
  return (
    <Suspense>
      <ConfermaEmail />
    </Suspense>
  );
}
