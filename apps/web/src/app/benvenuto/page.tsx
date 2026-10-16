import type { Metadata } from 'next';
import { Benvenuto } from '@/features/account/Benvenuto';

export const metadata: Metadata = { title: 'Benvenuto · Noxa' };

export default function PaginaBenvenuto() {
  return <Benvenuto />;
}
