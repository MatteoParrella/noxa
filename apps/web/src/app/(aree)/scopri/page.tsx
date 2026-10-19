import type { Metadata } from 'next';
import { VistaScopri } from '@/features/scopri/VistaScopri';

export const metadata: Metadata = { title: 'Scopri · Noxa' };

export default function PaginaScopri() {
  return <VistaScopri />;
}
