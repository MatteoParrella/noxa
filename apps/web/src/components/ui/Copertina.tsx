'use client';

import { useState, type ReactNode } from 'react';
import { classi } from '@/lib/classi';

export type DatiCopertina = {
  /** Ordine dell'ADR-0018: foto del locale, flyer approvato, fondo tipografico. */
  tipo: 'locale' | 'flyer' | 'tipografica';
  /** Link firmato dell'immagine; senza link (o se non si carica) vale il fondo tipografico. */
  url?: string | undefined;
  /** Testo alternativo, per esempio "Foto di Club Binario 7". */
  alt: string;
};

type Props = {
  copertina: DatiCopertina;
  forma: 'evidenza' | 'miniatura' | 'dettaglio';
  /** Fondo tipografico: orario e titolo (miniatura) o giorno, comune e orario (dettaglio). */
  ora: string;
  titolo: string;
  sopra?: string;
  className?: string;
  children?: ReactNode;
};

/**
 * Copertina di un evento (ADR-0018, design/F-01-scopri): foto del locale con la velatura dei
 * token, flyer approvato o fondo tipografico. La foto non contiene persone riconoscibili né
 * alcol (R-56); qui si mostra soltanto.
 */
export function Copertina({ copertina, forma, ora, titolo, sopra, className, children }: Props) {
  const [rotta, setRotta] = useState(false);
  const immagine = copertina.tipo !== 'tipografica' && copertina.url && !rotta;
  const tipo = immagine ? copertina.tipo : 'tipografica';

  return (
    <div
      className={classi(
        'copertina',
        `copertina-${forma}`,
        tipo === 'locale' && 'su-velatura',
        tipo === 'flyer' && 'copertina-flyer',
        tipo === 'tipografica' && 'copertina-tipo',
        className,
      )}
    >
      {immagine && (
        <>
          {/* Immagine firmata di un bucket privato: niente ottimizzazione di next/image nell'export statico. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="copertina-immagine"
            src={copertina.url}
            alt={forma === 'miniatura' ? '' : copertina.alt}
            loading="lazy"
            decoding="async"
            onError={() => setRotta(true)}
          />
          {tipo === 'locale' && <span className="velatura" aria-hidden="true" />}
        </>
      )}
      {tipo === 'tipografica' && forma === 'miniatura' && (
        <span className="mini-tipo" aria-hidden="true">
          <span>{ora}</span>
          <b>{titolo}</b>
        </span>
      )}
      {tipo === 'tipografica' && forma === 'dettaglio' && (
        <span className="cop-tipo" aria-hidden="true">
          {sopra && <span className="etichetta">{sopra}</span>}
          <span className="cop-ora">{ora}</span>
        </span>
      )}
      {children}
    </div>
  );
}
