import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DettaglioVoce } from '@/features/ricorda/DettaglioVoce';

export const metadata: Metadata = { title: 'Serata del diario · Noxa' };

export default function Pagina() {
  return (
    <div className="pagina pt-4 pb-8">
      <Suspense>
        <DettaglioVoce />
      </Suspense>
    </div>
  );
}
