'use client';

import { Search } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icona } from '@/components/ui/Icona';
import { classi } from '@/lib/classi';

type Scheda = { href: string; etichetta: string; attiva: boolean; extra?: ReactNode };

type Props = {
  titolo: ReactNode;
  conta?: string | undefined;
  /** Briciole sopra il titolo nelle schede di dettaglio. */
  briciole?: ReactNode;
  strumenti?: ReactNode;
  schede?: ReadonlyArray<Scheda>;
  filtri?: ReactNode;
  etichettaSchede?: string;
};

/** Intestazione delle pagine dell'area: titolo con conteggio, strumenti, schede e filtri. */
export function Testata({
  titolo,
  conta,
  briciole,
  strumenti,
  schede,
  filtri,
  etichettaSchede,
}: Props) {
  return (
    <header className="md-testa">
      {briciole}
      <div className="md-titolo-riga">
        <h1 className="md-titolo">
          {titolo}
          {conta !== undefined && <span className="conta">{conta}</span>}
        </h1>
        {strumenti && <div className="md-strumenti">{strumenti}</div>}
      </div>
      {filtri && <div className="md-filtri">{filtri}</div>}
      {schede && (
        <nav className="md-schede" aria-label={etichettaSchede}>
          {schede.map((scheda) => (
            <Link
              key={scheda.href}
              href={scheda.href}
              aria-current={scheda.attiva ? 'page' : undefined}
            >
              {scheda.etichetta}
              {scheda.extra}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

/** Campo di ricerca compatto delle testate. */
export function Ricerca({
  etichetta,
  valore,
  onCambia,
}: {
  etichetta: string;
  valore: string;
  onCambia: (valore: string) => void;
}) {
  return (
    <div className="campo-box campo-ricerca">
      <Icona icona={Search} dimensione="s" />
      <input
        type="search"
        aria-label={etichetta}
        placeholder={etichetta}
        value={valore}
        onChange={(evento) => onCambia(evento.target.value)}
      />
    </div>
  );
}

/** Pulsante di filtro a pillola, premuto o no. */
export function Filtro({
  attivo,
  onCambia,
  children,
}: {
  attivo: boolean;
  onCambia: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={classi('chip', attivo && 'is-on')}
      aria-pressed={attivo}
      onClick={onCambia}
    >
      {children}
    </button>
  );
}

/** Gruppo di filtri con l'etichetta da pensilina. */
export function GruppoFiltri({ etichetta, children }: { etichetta: string; children: ReactNode }) {
  return (
    <div className="md-filtri" role="group" aria-label={etichetta}>
      <span className="etichetta" aria-hidden="true">
        {etichetta}
      </span>
      {children}
    </div>
  );
}
