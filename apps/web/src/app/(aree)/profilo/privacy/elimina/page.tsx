import type { Metadata } from 'next';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { Icona } from '@/components/ui/Icona';
import { EliminaAccount } from '@/features/privacy/EliminaAccount';
import { messaggi } from '@/lib/messaggi/it';

export const metadata: Metadata = { title: 'Elimina l’account · Noxa' };

export default function Pagina() {
  return (
    <div className="pagina flex flex-col gap-2 pt-4">
      <Link className="btn btn-testo btn-s -ml-3 self-start" href="/profilo/privacy/">
        <Icona icona={ChevronLeft} dimensione="s" />
        {messaggi.privacy.elimina.sopratitolo}
      </Link>
      <EliminaAccount />
    </div>
  );
}
