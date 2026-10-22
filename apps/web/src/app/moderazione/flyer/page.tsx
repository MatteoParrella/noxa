'use client';

import { Suspense } from 'react';
import { Flyer } from '@/features/moderazione/Flyer';

export default function PaginaFlyer() {
  return (
    <Suspense>
      <Flyer />
    </Suspense>
  );
}
