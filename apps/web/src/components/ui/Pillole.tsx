'use client';

import { useRef, type KeyboardEvent, type ReactNode } from 'react';

export type OpzionePillola<V extends string> = {
  valore: V;
  etichetta: string;
  icona?: ReactNode;
  disattivata?: boolean;
};

type Props<V extends string> = {
  etichetta: string;
  opzioni: ReadonlyArray<OpzionePillola<V>>;
  valore: V | null;
  onCambia: (valore: V) => void;
  /** Tutto il gruppo spento, per esempio senza rete o in una serata annullata. */
  disattivato?: boolean;
  /** Id dell'elemento che spiega il gruppo (per esempio la domanda "Come torni?"). */
  descrittoDa?: string;
};

/**
 * Scelta singola tra opzioni che vanno a capo (stato del biglietto, mezzo di trasporto;
 * design/F-14-serata): un radiogroup con le frecce da tastiera che salta le opzioni spente.
 */
export function Pillole<V extends string>({
  etichetta,
  opzioni,
  valore,
  onCambia,
  disattivato = false,
  descrittoDa,
}: Props<V>) {
  const riferimenti = useRef<Array<HTMLButtonElement | null>>([]);
  const attive = opzioni.filter((opzione) => !opzione.disattivata);
  const primaAttiva = attive[0]?.valore;
  const nessuna = !attive.some((opzione) => opzione.valore === valore);

  function tasto(evento: KeyboardEvent<HTMLButtonElement>, indice: number) {
    const passo =
      evento.key === 'ArrowRight' || evento.key === 'ArrowDown'
        ? 1
        : evento.key === 'ArrowLeft' || evento.key === 'ArrowUp'
          ? -1
          : 0;
    if (passo === 0) return;
    evento.preventDefault();
    for (let salto = 1; salto <= opzioni.length; salto += 1) {
      const prossimo = (indice + passo * salto + opzioni.length * salto) % opzioni.length;
      const opzione = opzioni[prossimo];
      if (opzione && !opzione.disattivata) {
        onCambia(opzione.valore);
        riferimenti.current[prossimo]?.focus();
        return;
      }
    }
  }

  return (
    <div
      className="pillole"
      role="radiogroup"
      aria-label={etichetta}
      aria-describedby={descrittoDa}
      aria-disabled={disattivato || undefined}
    >
      {opzioni.map((opzione, indice) => {
        const selezionata = opzione.valore === valore;
        const raggiungibile = selezionata || (nessuna && opzione.valore === primaAttiva);
        return (
          <button
            key={opzione.valore}
            ref={(el) => {
              riferimenti.current[indice] = el;
            }}
            type="button"
            role="radio"
            className="pillola"
            aria-checked={selezionata}
            disabled={disattivato || opzione.disattivata}
            tabIndex={raggiungibile ? 0 : -1}
            onClick={() => onCambia(opzione.valore)}
            onKeyDown={(evento) => tasto(evento, indice)}
          >
            {opzione.icona}
            {opzione.etichetta}
          </button>
        );
      })}
    </div>
  );
}
