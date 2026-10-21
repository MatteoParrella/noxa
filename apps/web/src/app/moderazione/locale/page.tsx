'use client';

import { Suspense } from 'react';
import { SchedaLocale } from '@/features/moderazione/SchedaLocale';

export default function PaginaLocale() {
  return (
    <Suspense>
      <SchedaLocale />
    </Suspense>
  );
}
