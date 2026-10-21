import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { GuscioModerazione } from '@/features/moderazione/GuscioModerazione';

export const metadata: Metadata = {
  title: 'Moderazione · Noxa',
  robots: { index: false, follow: false },
};

/** Area di moderazione (F-40): navigazione propria, niente barra delle 5 aree dell'app. */
export default function LayoutModerazione({ children }: Readonly<{ children: ReactNode }>) {
  return <GuscioModerazione>{children}</GuscioModerazione>;
}
