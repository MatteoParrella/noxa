'use client';

import { Suspense } from 'react';
import { SchedaFonte } from '@/features/moderazione/SchedaFonte';

export default function PaginaFonte() {
  return (
    <Suspense>
      <SchedaFonte />
    </Suspense>
  );
}
