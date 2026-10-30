import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ModuloSerata } from '@/features/ricorda/ModuloSerata';

export const metadata: Metadata = { title: 'Serata del diario · Noxa' };

export default function Pagina() {
  return (
    <div className="pagina pt-4">
      <Suspense>
        <ModuloSerata />
      </Suspense>
    </div>
  );
}
