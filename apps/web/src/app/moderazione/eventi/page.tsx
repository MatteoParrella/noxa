'use client';

import { Suspense } from 'react';
import { Eventi } from '@/features/moderazione/Eventi';

export default function PaginaEventi() {
  return (
    <Suspense>
      <Eventi />
    </Suspense>
  );
}
