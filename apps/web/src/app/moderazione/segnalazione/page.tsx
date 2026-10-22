'use client';

import { Suspense } from 'react';
import { DettaglioSegnalazione } from '@/features/moderazione/DettaglioSegnalazione';

export default function PaginaSegnalazione() {
  return (
    <Suspense>
      <DettaglioSegnalazione />
    </Suspense>
  );
}
