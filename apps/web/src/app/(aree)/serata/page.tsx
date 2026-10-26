import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DettaglioSerata } from '@/features/gruppi/DettaglioSerata';

export const metadata: Metadata = { title: 'Serata di gruppo · Noxa' };

export default function Pagina() {
  return (
    <div className="pagina pt-4 pb-8">
      <Suspense>
        <DettaglioSerata />
      </Suspense>
    </div>
  );
}
