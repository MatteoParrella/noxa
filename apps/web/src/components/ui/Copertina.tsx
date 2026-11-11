'use client';

import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { classi } from '@/lib/classi';
import {
  corpoTitolo,
  elementiMotivo,
  parametri,
  titoloCorto,
  titoloManifesto,
  type ColoriCopertina,
  type ElementoMotivo,
  type Famiglia,
} from '@/lib/copertinaGenerata';

/** Copertina generata (design/F-01-copertine-generate): seme, famiglia e colori della fonte. */
export type DatiGenerata = {
  seme: string;
  famiglia: Famiglia;
  /** Colori letti dall'immagine della fonte (ADR-0030); senza, quelli della famiglia. */
  colori?: ColoriCopertina | null;
};

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
  /** Al posto del fondo tipografico, quando c'è il seme della serata. */
  generata?: DatiGenerata;
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
  const generata = tipo === 'tipografica' && !sostitutiva ? copertina.generata : undefined;

  if (generata) {
    return (
      <CopertinaGenerata
        generata={generata}
        forma={forma}
        ora={ora}
        titolo={titolo}
        sopra={sopra}
        className={className}
      >
        {children}
      </CopertinaGenerata>
    );
  }

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

type PropsGenerata = Omit<Props, 'copertina' | 'sopra' | 'className'> & {
  generata: DatiGenerata;
  sopra: string | undefined;
  className: string | undefined;
};

/**
 * Locandina astratta della serata: motivo dal seme, colori dalla fonte o dal genere, testo su
 * velatura del fondo (contrasto ≥ 12,7:1, ALGORITMO §5). Decorativa: le informazioni sono
 * scritte nella scheda, quindi è nascosta ai lettori di schermo.
 */
function CopertinaGenerata({
  generata,
  forma,
  ora,
  titolo,
  sopra,
  className,
  children,
}: PropsGenerata) {
  const p = useMemo(() => parametri(generata.seme), [generata.seme]);
  const elementi = useMemo(() => elementiMotivo(p), [p]);
  const manifesto = titoloManifesto(titolo);
  const colori = generata.colori;
  const stile = {
    '--cg-gx': `${p.bagliore.x}%`,
    '--cg-gy': `${p.bagliore.y}%`,
    '--cg-gr': `${p.bagliore.r}%`,
    ...(colori
      ? {
          '--cgs-fondo': colori.scuro.fondo,
          '--cgs-1': colori.scuro[1],
          '--cgs-2': colori.scuro[2],
          '--cgs-bagliore': colori.scuro.bagliore,
          '--cgc-fondo': colori.chiaro.fondo,
          '--cgc-1': colori.chiaro[1],
          '--cgc-2': colori.chiaro[2],
          '--cgc-bagliore': colori.chiaro.bagliore,
        }
      : {}),
  } as CSSProperties;

  return (
    <div
      className={classi(
        'copertina',
        `copertina-${forma}`,
        'cg',
        colori ? 'cg-dati' : `cg-${generata.famiglia}`,
        className,
      )}
      style={stile}
      data-motivo={p.motivo}
    >
      <svg
        viewBox="0 0 400 250"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        focusable="false"
      >
        <g transform={`rotate(${p.angolo} 200 125) scale(1.18) translate(-30 -19)`}>
          {elementi.map((elemento, indice) => (
            <ElementoSvg key={indice} elemento={elemento} />
          ))}
        </g>
      </svg>
      <span className={classi('cg-velo', forma === 'miniatura' && 'alto')} aria-hidden="true" />
      {forma === 'miniatura' && (
        <span className="cg-mini" aria-hidden="true">
          <span className="cg-ora">{ora}</span>
          <b className="cg-titolo">{titoloCorto(manifesto)}</b>
        </span>
      )}
      {forma === 'dettaglio' && (
        <span className="cg-det" aria-hidden="true">
          {sopra && <span className="cg-etichetta">{sopra}</span>}
          <span className="cg-ora">{ora}</span>
          <span className={classi('cg-titolo', corpoTitolo(manifesto))}>{manifesto}</span>
        </span>
      )}
      {children}
    </div>
  );
}

function ElementoSvg({ elemento }: { elemento: ElementoMotivo }) {
  // var(--cg-*) vale solo nello stile, non negli attributi di presentazione SVG.
  const { fill, stroke, strokeWidth, opacity } = elemento.stile;
  const comuni = {
    style: { fill, stroke, strokeWidth, opacity, strokeLinecap: stroke ? 'round' : undefined },
  } satisfies { style: CSSProperties };
  if (elemento.tipo === 'path') return <path d={elemento.d} {...comuni} />;
  if (elemento.tipo === 'circle')
    return <circle cx={elemento.cx} cy={elemento.cy} r={elemento.r} {...comuni} />;
  return (
    <rect
      x={elemento.x}
      y={elemento.y}
      width={elemento.width}
      height={elemento.height}
      rx={2}
      {...comuni}
    />
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
