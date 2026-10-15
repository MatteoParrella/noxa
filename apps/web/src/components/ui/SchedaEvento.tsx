import Image from 'next/image';
import type { ReactNode } from 'react';
import { Badge } from './Badge';

export type ImmagineEvento = {
  url: string;
  /** Testo alternativo, per esempio "Foto di Magazzino Nove". */
  alt: string;
  /** Attribuzione richiesta dalla licenza della foto (ADR-0018). */
  attribuzione?: string;
};

type Props = {
  titolo: string;
  locale: string;
  zona: string;
  orario: string;
  /** Età minima già calcolata nel database ("14+", "18+"). */
  eta: string;
  /**
   * Foto del locale; in mancanza il flyer approvato. Senza immagine si usa il fondo
   * tipografico (ADR-0018).
   */
  immagine?: ImmagineEvento;
  dettagli?: ReactNode;
  azioni?: ReactNode;
};

/** Scheda evento con la foto del locale come sfondo e una velatura per il contrasto. */
export function SchedaEvento({
  titolo,
  locale,
  zona,
  orario,
  eta,
  immagine,
  dettagli,
  azioni,
}: Props) {
  return (
    <article className="scheda scheda-evento" aria-label={`${titolo}, ${locale}`}>
      <div className="scheda-evento-copertina">
        {immagine ? (
          <Image
            src={immagine.url}
            alt={immagine.alt}
            fill
            sizes="(max-width: 600px) 100vw, 560px"
          />
        ) : (
          <span className="scheda-evento-fondo" aria-hidden="true" />
        )}
        <Badge variante="eta" className="scheda-evento-eta">
          {eta}
        </Badge>
        <div className="scheda-evento-velo">
          <span className="t-mono-dato">{orario}</span>
          <h3 className="scheda-evento-titolo">{titolo}</h3>
        </div>
      </div>
      <div className="scheda-evento-corpo">
        <span className="t-corpo-s c-2">
          {locale} · {zona}
        </span>
        {dettagli}
        {immagine?.attribuzione && (
          <span className="t-didascalia">Foto: {immagine.attribuzione}</span>
        )}
        {azioni && <div className="flex items-center gap-1">{azioni}</div>}
      </div>
    </article>
  );
}
