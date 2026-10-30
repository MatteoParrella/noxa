import type { Metadata } from 'next';
import { AccountEliminato } from '@/features/privacy/EliminaAccount';

export const metadata: Metadata = { title: 'Account eliminato · Noxa' };

export default function Pagina() {
  return <AccountEliminato />;
}
