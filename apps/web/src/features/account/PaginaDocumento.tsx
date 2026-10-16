'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { PERCORSI } from './documenti';
import { Schermata } from './Schermata';

type Props = { etichetta: string; titolo: string; children: ReactNode };

/** Pagina di un testo lungo (termini, informativa), leggibile anche senza account. */
export function PaginaDocumento({ etichetta, titolo, children }: Props) {
  const router = useRouter();
  return (
    <Schermata
      etichetta={etichetta}
      titolo={titolo}
      onIndietro={() => {
        if (window.history.length > 1) router.back();
        else router.push(PERCORSI.benvenuto);
      }}
    >
      <article className="documento">{children}</article>
    </Schermata>
  );
}
