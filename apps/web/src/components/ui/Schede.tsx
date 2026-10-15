'use client';

import type { KeyboardEvent, ReactNode } from 'react';
import { useId, useRef } from 'react';
import { classi } from '@/lib/classi';

export type Scheda<V extends string> = {
  valore: V;
  etichetta: string;
  extra?: ReactNode;
  contenuto: ReactNode;
};

type Props<V extends string> = {
  etichetta: string;
  schede: ReadonlyArray<Scheda<V>>;
  valore: V;
  onCambia: (valore: V) => void;
};

/** Tab con pannelli (pattern ARIA tablist): frecce, Home e Fine per spostarsi. */
export function Schede<V extends string>({ etichetta, schede, valore, onCambia }: Props<V>) {
  const id = useId();
  const riferimenti = useRef<Array<HTMLButtonElement | null>>([]);

  function tasto(evento: KeyboardEvent<HTMLButtonElement>, indice: number) {
    let prossimo: number | null = null;
    if (evento.key === 'ArrowRight') prossimo = (indice + 1) % schede.length;
    if (evento.key === 'ArrowLeft') prossimo = (indice - 1 + schede.length) % schede.length;
    if (evento.key === 'Home') prossimo = 0;
    if (evento.key === 'End') prossimo = schede.length - 1;
    if (prossimo === null) return;
    evento.preventDefault();
    const scheda = schede[prossimo];
    if (!scheda) return;
    onCambia(scheda.valore);
    riferimenti.current[prossimo]?.focus();
  }

  return (
    <div>
      <div className="tabs" role="tablist" aria-label={etichetta}>
        {schede.map((scheda, indice) => {
          const selezionata = scheda.valore === valore;
          return (
            <button
              key={scheda.valore}
              ref={(el) => {
                riferimenti.current[indice] = el;
              }}
              id={`${id}-tab-${scheda.valore}`}
              type="button"
              role="tab"
              aria-selected={selezionata}
              aria-controls={`${id}-pannello-${scheda.valore}`}
              tabIndex={selezionata ? 0 : -1}
              className={classi('tab', selezionata && 'is-on')}
              onClick={() => onCambia(scheda.valore)}
              onKeyDown={(e) => tasto(e, indice)}
            >
              {scheda.etichetta}
              {scheda.extra}
            </button>
          );
        })}
      </div>
      {schede.map((scheda) => (
        <div
          key={scheda.valore}
          id={`${id}-pannello-${scheda.valore}`}
          role="tabpanel"
          aria-labelledby={`${id}-tab-${scheda.valore}`}
          hidden={scheda.valore !== valore}
          tabIndex={0}
          className="pt-4"
        >
          {scheda.valore === valore && scheda.contenuto}
        </div>
      ))}
    </div>
  );
}
