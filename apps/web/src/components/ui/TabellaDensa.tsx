'use client';

import type { KeyboardEvent, ReactNode } from 'react';
import { useRef } from 'react';
import { classi } from '@/lib/classi';

export type ColonnaTabella<T> = {
  chiave: string;
  titolo: string;
  cella: (riga: T) => ReactNode;
  /** Classi della cella: `mono`, `num`, `nasc-1024`, `nasc-390`. */
  classe?: string;
};

type Props<T> = {
  /** Didascalia accessibile della tabella. */
  etichetta: string;
  colonne: ReadonlyArray<ColonnaTabella<T>>;
  righe: ReadonlyArray<T>;
  chiaveRiga: (riga: T) => string;
  /**
   * Prima colonna: il collegamento o il pulsante che apre la riga. È l'unico elemento
   * raggiungibile con Tab; le frecce su e giù passano alla riga precedente o successiva.
   */
  prima: (riga: T) => ReactNode;
  titoloPrima: string;
  selezionata?: string | null | undefined;
  onApri?: (riga: T) => void;
};

/**
 * Tabella densa dell'area di moderazione: righe di almeno 44 px, dati in monospaziato, stati
 * scritti. A 390 px diventa un elenco di schede con l'etichetta di ogni dato.
 */
export function TabellaDensa<T>({
  etichetta,
  colonne,
  righe,
  chiaveRiga,
  prima,
  titoloPrima,
  selezionata = null,
  onApri,
}: Props<T>) {
  const corpo = useRef<HTMLTableSectionElement>(null);

  function tasto(evento: KeyboardEvent<HTMLTableSectionElement>) {
    if (evento.key !== 'ArrowDown' && evento.key !== 'ArrowUp') return;
    const elementi = Array.from(
      corpo.current?.querySelectorAll<HTMLElement>('[data-apri-riga]') ?? [],
    );
    const attuale = elementi.indexOf(document.activeElement as HTMLElement);
    if (attuale < 0) return;
    evento.preventDefault();
    const prossimo = evento.key === 'ArrowDown' ? attuale + 1 : attuale - 1;
    elementi[Math.max(0, Math.min(prossimo, elementi.length - 1))]?.focus();
  }

  return (
    <table className="tab-densa">
      <caption className="sr-only">{etichetta}</caption>
      <thead>
        <tr>
          <th scope="col">{titoloPrima}</th>
          {colonne.map((colonna) => (
            <th key={colonna.chiave} scope="col" className={colonna.classe}>
              {colonna.titolo}
            </th>
          ))}
        </tr>
      </thead>
      <tbody ref={corpo} onKeyDown={tasto}>
        {righe.map((riga) => {
          const chiave = chiaveRiga(riga);
          return (
            <tr
              key={chiave}
              className={classi(chiave === selezionata && 'is-sel')}
              onClick={(evento) => {
                // Un clic su un controllo della riga non apre la riga.
                if ((evento.target as HTMLElement).closest('a, button, input, select')) return;
                onApri?.(riga);
              }}
            >
              <td className="cella-prima">{prima(riga)}</td>
              {colonne.map((colonna) => (
                <td key={colonna.chiave} className={colonna.classe} data-l={colonna.titolo}>
                  {colonna.cella(riga)}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
