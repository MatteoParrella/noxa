import type { Metadata } from 'next';
import { Registrazione } from '@/features/account/Registrazione';

export const metadata: Metadata = { title: 'Crea un account · Noxa' };

export default function PaginaRegistrazione() {
  return <Registrazione />;
}
