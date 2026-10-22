'use client';

import { useState, type ReactNode } from 'react';
import { classi } from '@/lib/classi';

export type DatiCopertina = {
  /**
   * Ordine dell'ADR-0018: foto del locale, flyer approvato, fondo tipografico. `sostitutiva`:
   * l'immagine è nascosta in attesa della revisione e al suo posto c'è un'illustrazione
   * notturna disegnata per Noxa, senza diritti di terzi (ADR-0023).
   */
  tipo: 'locale' | 'flyer' | 'tipografica' | 'sostitutiva';
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
  const immagine =
    (copertina.tipo === 'locale' || copertina.tipo === 'flyer') && copertina.url && !rotta;
  const sostitutiva = copertina.tipo === 'sostitutiva';
  const tipo = immagine ? copertina.tipo : 'tipografica';

  return (
    <div
      className={classi(
        'copertina',
        `copertina-${forma}`,
        tipo === 'locale' && 'su-velatura',
        tipo === 'flyer' && 'copertina-flyer',
        tipo === 'tipografica' && (sostitutiva ? 'copertina-sostitutiva' : 'copertina-tipo'),
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
      {sostitutiva && <IllustrazioneNotte />}
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

/** Strada di notte con un lampione: illustrazione decorativa, colori dai token. */
function IllustrazioneNotte() {
  return (
    <svg
      className="illustrazione-notte"
      viewBox="0 0 320 180"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id="bagliore-lampione" cx="0.72" cy="0.22" r="0.55">
          <stop offset="0" stopColor="var(--colore-accento)" stopOpacity="0.55" />
          <stop offset="1" stopColor="var(--colore-accento)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="180" fill="url(#bagliore-lampione)" />
      <path
        d="M0 150 L40 150 L40 108 L78 108 L78 128 L118 128 L118 92 L150 92 L150 140 L200 140 L200 116 L250 116 L250 134 L320 134 L320 180 L0 180 Z"
        fill="var(--colore-sfondo)"
        opacity="0.85"
      />
      <path
        d="M230 180 L230 40 Q230 30 240 30 L254 30"
        stroke="var(--colore-linea-forte)"
        strokeWidth="3"
        fill="none"
      />
      <circle cx="256" cy="34" r="5" fill="var(--colore-accento)" />
    </svg>
  );
}
