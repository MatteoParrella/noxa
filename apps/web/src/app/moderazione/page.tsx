'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { PERCORSI_MODERAZIONE } from '@/features/moderazione/GuscioModerazione';

/** L'area si apre sui locali. */
export default function PaginaModerazione() {
  const router = useRouter();
  useEffect(() => router.replace(PERCORSI_MODERAZIONE.locali), [router]);
  return null;
}
