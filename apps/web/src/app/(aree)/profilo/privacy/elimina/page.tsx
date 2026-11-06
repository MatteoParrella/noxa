import type { Metadata } from 'next';
import { LinkIndietro } from '@/components/guscio/Indietro';
import { EliminaAccount } from '@/features/privacy/EliminaAccount';
import { messaggi } from '@/lib/messaggi/it';

export const metadata: Metadata = { title: 'Elimina l’account · Noxa' };

export default function Pagina() {
  return (
    <div className="pagina flex flex-col gap-2 pt-4">
      <LinkIndietro
        className="self-start"
        href="/profilo/privacy/"
        etichetta={messaggi.privacy.elimina.sopratitolo}
      />
      <EliminaAccount />
    </div>
  );
}
