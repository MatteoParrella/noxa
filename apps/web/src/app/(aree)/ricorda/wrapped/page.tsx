import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Wrapped } from '@/features/ricorda/Wrapped';

export const metadata: Metadata = { title: 'Il tuo anno · Noxa' };

export default function Pagina() {
  return (
    <Suspense>
      <Wrapped />
    </Suspense>
  );
}
