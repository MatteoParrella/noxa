import type { Metadata } from 'next';
import { Suspense } from 'react';
import { NuovaPassword } from '@/features/account/NuovaPassword';

export const metadata: Metadata = { title: 'Nuova password · Noxa' };

export default function PaginaNuovaPassword() {
  return (
    <Suspense>
      <NuovaPassword />
    </Suspense>
  );
}
