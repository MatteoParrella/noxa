import type { Metadata } from 'next';
import { OnboardingSicurezza } from '@/features/account/OnboardingSicurezza';

export const metadata: Metadata = { title: 'La tua sicurezza · Noxa' };

export default function PaginaSicurezza() {
  return <OnboardingSicurezza />;
}
