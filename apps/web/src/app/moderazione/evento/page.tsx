'use client';

import { Suspense } from 'react';
import { SchedaEvento } from '@/features/moderazione/SchedaEvento';

export default function PaginaEventoModerazione() {
  return (
    <Suspense>
      <SchedaEvento />
    </Suspense>
  );
}
