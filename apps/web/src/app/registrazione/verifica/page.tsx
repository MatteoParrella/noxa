import type { Metadata } from 'next';
import { VerificaEmail } from '@/features/account/VerificaEmail';

export const metadata: Metadata = { title: 'Controlla la posta · Noxa' };

export default function PaginaVerifica() {
  return <VerificaEmail />;
}
