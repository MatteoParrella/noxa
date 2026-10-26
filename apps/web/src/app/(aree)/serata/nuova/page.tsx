import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ProponiSerata } from '@/features/gruppi/ProponiSerata';

export const metadata: Metadata = { title: 'Proponi una serata · Noxa' };

export default function Pagina() {
  return (
    <div className="pagina pt-4 pb-8">
      <Suspense>
        <ProponiSerata />
      </Suspense>
    </div>
  );
}
