'use client';

import { Suspense } from 'react';
import { Locali } from '@/features/moderazione/Locali';

export default function PaginaLocali() {
  return (
    <Suspense>
      <Locali />
    </Suspense>
  );
}
