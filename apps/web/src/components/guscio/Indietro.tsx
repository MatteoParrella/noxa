'use client';

import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useSyncExternalStore, type MouseEvent } from 'react';
import { Icona } from '@/components/ui/Icona';
import {
  conBarra,
  nomePagina,
  osservaCronologia,
  paginaPrecedente,
  registraPagina,
} from '@/lib/navigazione';

function Registra() {
  const percorso = usePathname();
  const parametri = useSearchParams().toString();
  useEffect(() => {
    registraPagina(parametri ? `${conBarra(percorso)}?${parametri}` : conBarra(percorso));
  }, [percorso, parametri]);
  return null;
}

/** Tiene la cronologia interna dell'app (lib/navigazione.ts); va montato una volta nel guscio. */
export function TracciaNavigazione() {
  return (
    <Suspense fallback={null}>
      <Registra />
    </Suspense>
  );
}

/**
 * Destinazione del pulsante "indietro": la pagina precedente dell'app se c'è, altrimenti la
 * pagina madre `ripiego`. Sul server e al primo disegno vale il ripiego, così l'HTML statico
 * coincide con l'idratazione.
 */
export function useIndietro(ripiego: { href: string; etichetta: string }) {
  const router = useRouter();
  const percorso = conBarra(usePathname());
  const precedente = useSyncExternalStore(
    osservaCronologia,
    () => paginaPrecedente(percorso),
    () => null,
  );
  return {
    href: precedente ?? ripiego.href,
    // Se la pagina precedente è proprio la madre, vale il suo nome (per esempio quello del
    // gruppo); altrimenti il nome della pagina da cui si è arrivati.
    etichetta:
      precedente && precedente !== ripiego.href ? nomePagina(precedente) : ripiego.etichetta,
    onClick: (evento: MouseEvent) => {
      // Con una pagina precedente si torna davvero indietro, come il tasto del telefono:
      // posizione di scorrimento e stato della pagina restano quelli lasciati.
      if (
        paginaPrecedente(percorso) === null ||
        evento.metaKey ||
        evento.ctrlKey ||
        evento.shiftKey
      )
        return;
      evento.preventDefault();
      router.back();
    },
  };
}

type Props = {
  /** Pagina madre, usata quando non c'è una pagina precedente dell'app. */
  href: string;
  etichetta: string;
  className?: string;
};

/** Link "indietro" delle pagine interne, con freccia ed etichetta della pagina di arrivo. */
export function LinkIndietro({ href, etichetta, className = 'btn btn-testo btn-s -ml-3' }: Props) {
  const indietro = useIndietro({ href, etichetta });
  return (
    <Link className={className} href={indietro.href} onClick={indietro.onClick}>
      <Icona icona={ChevronLeft} dimensione="s" />
      {indietro.etichetta}
    </Link>
  );
}
