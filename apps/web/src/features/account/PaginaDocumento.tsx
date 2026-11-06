'use client';

import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { conBarra, paginaPrecedente } from '@/lib/navigazione';
import { PERCORSI } from './documenti';
import { Schermata } from './Schermata';

type Props = { etichetta: string; titolo: string; children: ReactNode };

/** Pagina di un testo lungo (termini, informativa), leggibile anche senza account. */
export function PaginaDocumento({ etichetta, titolo, children }: Props) {
  const router = useRouter();
  const percorso = conBarra(usePathname());
  return (
    <Schermata
      etichetta={etichetta}
      titolo={titolo}
      onIndietro={() => {
        // Si torna alla pagina dell'app da cui si è arrivati; aperta da un link esterno, al
        // benvenuto (lib/navigazione.ts).
        if (paginaPrecedente(percorso) !== null) router.back();
        else router.push(PERCORSI.benvenuto);
      }}
    >
      <article className="documento">{children}</article>
    </Schermata>
  );
}
