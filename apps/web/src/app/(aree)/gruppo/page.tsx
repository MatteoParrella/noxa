import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DettaglioGruppo } from '@/features/gruppi/DettaglioGruppo';

export const metadata: Metadata = { title: 'Gruppo · Noxa' };

export default function Pagina() {
  return (
    <div className="pagina pt-4 pb-8">
      <Suspense>
        <DettaglioGruppo />
      </Suspense>
    </div>
  );
}
