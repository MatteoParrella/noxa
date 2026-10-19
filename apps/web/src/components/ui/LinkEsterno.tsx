import { ExternalLink, type LucideIcon } from 'lucide-react';
import { messaggi } from '@/lib/messaggi/it';
import { Icona } from './Icona';

type Props = {
  href: string;
  icona: LucideIcon;
  etichetta: string;
  /** Destinazione scritta a destra: il dominio o "sito esterno". */
  destinazione: string;
  /** Senza rete il link resta visibile ma spento (design/F-01-scopri, dettaglio offline). */
  disattivato?: boolean;
};

/** Riga con un link esterno (fonte, biglietti): si apre fuori dall'app, senza urgenza (R-43). */
export function LinkEsterno({ href, icona, etichetta, destinazione, disattivato = false }: Props) {
  const contenuto = (
    <>
      <Icona icona={icona} className="ico-riga" />
      <span>{etichetta}</span>
      <span className="dest">
        {destinazione}
        <Icona icona={ExternalLink} dimensione="s" />
      </span>
    </>
  );
  if (disattivato) {
    return (
      <span className="link-riga is-disattivato" aria-disabled="true">
        {contenuto}
      </span>
    );
  }
  return (
    <a className="link-riga" href={href} target="_blank" rel="noopener noreferrer">
      {contenuto}
      <span className="sr-only">{messaggi.evento.apreSitoEsterno}</span>
    </a>
  );
}
