import type { Metadata } from 'next';
import { Accesso } from '@/features/account/Accesso';

export const metadata: Metadata = { title: 'Accedi · Noxa' };

export default function PaginaAccesso() {
  return <Accesso />;
}
