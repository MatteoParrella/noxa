import type { Metadata } from 'next';
import { Catalogo } from '@/features/catalogo/Catalogo';

export const metadata: Metadata = {
  title: 'Catalogo dei componenti · Noxa',
  robots: { index: false },
};

/** Catalogo dei componenti del design system: solo in sviluppo e nei test e2e (DESIGN.md §3). */
export default function PaginaCatalogo() {
  return (
    <main className="grid gap-8 p-5 lg:grid-cols-2">
      <Catalogo tema="scuro" />
      <Catalogo tema="chiaro" />
    </main>
  );
}
