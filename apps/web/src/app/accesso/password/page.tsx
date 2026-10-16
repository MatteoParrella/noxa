import type { Metadata } from 'next';
import { RecuperoPassword } from '@/features/account/RecuperoPassword';

export const metadata: Metadata = { title: 'Password dimenticata · Noxa' };

export default function PaginaRecupero() {
  return <RecuperoPassword />;
}
