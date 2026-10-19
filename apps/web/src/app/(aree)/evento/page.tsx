import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DettaglioEvento } from '@/features/scopri/DettaglioEvento';

export const metadata: Metadata = { title: 'Evento · Noxa' };

export default function PaginaEvento() {
  return (
    <Suspense>
      <DettaglioEvento />
    </Suspense>
  );
}
