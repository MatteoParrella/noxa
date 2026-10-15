'use client';

import type { KeyboardEvent, ReactNode } from 'react';
import { useRef } from 'react';
import { classi } from '@/lib/classi';

export type OpzioneSegmento<V extends string> = { valore: V; etichetta: string; icona?: ReactNode };

type Props<V extends string> = {
  etichetta: string;
  opzioni: ReadonlyArray<OpzioneSegmento<V>>;
  valore: V;
  onCambia: (valore: V) => void;
};

/** Scelta singola tra poche opzioni (radiogroup), con le frecce da tastiera. */
export function Segmenti<V extends string>({ etichetta, opzioni, valore, onCambia }: Props<V>) {
  const riferimenti = useRef<Array<HTMLButtonElement | null>>([]);

  function tasto(evento: KeyboardEvent<HTMLButtonElement>, indice: number) {
    const passo =
      evento.key === 'ArrowRight' || evento.key === 'ArrowDown'
        ? 1
        : evento.key === 'ArrowLeft' || evento.key === 'ArrowUp'
          ? -1
          : 0;
    if (passo === 0) return;
    evento.preventDefault();
    const prossimo = (indice + passo + opzioni.length) % opzioni.length;
    const opzione = opzioni[prossimo];
    if (!opzione) return;
    onCambia(opzione.valore);
    riferimenti.current[prossimo]?.focus();
  }

  return (
    <div className="segmenti" role="radiogroup" aria-label={etichetta}>
      {opzioni.map((opzione, indice) => {
        const selezionato = opzione.valore === valore;
        return (
          <button
            key={opzione.valore}
            ref={(el) => {
              riferimenti.current[indice] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selezionato}
            tabIndex={selezionato ? 0 : -1}
            className={classi('segmento', selezionato && 'is-on')}
            onClick={() => onCambia(opzione.valore)}
            onKeyDown={(e) => tasto(e, indice)}
          >
            {opzione.icona}
            {opzione.etichetta}
          </button>
        );
      })}
    </div>
  );
}
