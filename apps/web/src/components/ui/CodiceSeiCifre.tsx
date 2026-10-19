'use client';

import { CircleAlert } from 'lucide-react';
import { useId, useRef, type ClipboardEvent, type KeyboardEvent } from 'react';
import { classi } from '@/lib/classi';
import { Icona } from './Icona';

type Props = {
  etichetta: string;
  /** Etichetta accessibile di ogni casella, per esempio "Cifra 1 di 6". */
  etichettaCifra: (numero: number) => string;
  valore: string;
  onCambia: (valore: string) => void;
  /** Chiamata quando tutte le 6 cifre sono scritte. */
  onCompleto?: (valore: string) => void;
  errore?: string | undefined;
  disabled?: boolean;
  autoFocus?: boolean;
};

const CIFRE = 6;

/**
 * Codice a 6 cifre a caselle (design/F-40-moderazione-fonti, tavola 01): si scrive, si
 * incolla tutto insieme o si corregge con Backspace e le frecce. Il valore resta una stringa
 * di sole cifre; con un errore il campo non si svuota, così si correggono le ultime cifre.
 */
export function CodiceSeiCifre({
  etichetta,
  etichettaCifra,
  valore,
  onCambia,
  onCompleto,
  errore,
  disabled = false,
  autoFocus = false,
}: Props) {
  const id = useId();
  const caselle = useRef<Array<HTMLInputElement | null>>([]);
  const cifre = Array.from({ length: CIFRE }, (_, indice) => valore[indice] ?? '');

  function imposta(nuovo: string, focus: number) {
    const pulito = nuovo.replace(/\D/g, '').slice(0, CIFRE);
    onCambia(pulito);
    caselle.current[Math.min(focus, CIFRE - 1)]?.focus();
    if (pulito.length === CIFRE) onCompleto?.(pulito);
  }

  function scrivi(indice: number, testo: string) {
    const nuove = testo.replace(/\D/g, '');
    if (!nuove) return;
    const prima = cifre.slice(0, indice).join('');
    imposta(prima + nuove, indice + nuove.length);
  }

  function tasto(evento: KeyboardEvent<HTMLInputElement>, indice: number) {
    if (evento.key === 'Backspace') {
      evento.preventDefault();
      const posizione = cifre[indice] ? indice : Math.max(indice - 1, 0);
      imposta(cifre.slice(0, posizione).join(''), posizione);
    } else if (evento.key === 'ArrowLeft') {
      caselle.current[Math.max(indice - 1, 0)]?.focus();
    } else if (evento.key === 'ArrowRight') {
      caselle.current[Math.min(indice + 1, valore.length, CIFRE - 1)]?.focus();
    }
  }

  function incolla(evento: ClipboardEvent<HTMLInputElement>) {
    evento.preventDefault();
    imposta(evento.clipboardData.getData('text'), CIFRE);
  }

  return (
    <fieldset
      className="m-0 flex flex-col gap-2 border-0 p-0"
      aria-describedby={errore ? `${id}-errore` : undefined}
    >
      <legend className="campo-etichetta mb-2 p-0">{etichetta}</legend>
      <div className={classi('codice6', errore && 'is-errore')}>
        {cifre.map((cifra, indice) => (
          <input
            key={indice}
            ref={(elemento) => {
              caselle.current[indice] = elemento;
            }}
            value={cifra}
            onChange={(evento) => scrivi(indice, evento.target.value)}
            onKeyDown={(evento) => tasto(evento, indice)}
            onPaste={incolla}
            onFocus={(evento) => evento.target.select()}
            inputMode="numeric"
            autoComplete={indice === 0 ? 'one-time-code' : 'off'}
            pattern="[0-9]*"
            maxLength={CIFRE}
            aria-label={etichettaCifra(indice + 1)}
            aria-invalid={errore ? true : undefined}
            disabled={disabled}
            // Il primo campo prende il focus all'apertura della schermata del codice.
            autoFocus={autoFocus && indice === 0}
          />
        ))}
      </div>
      {errore && (
        <span className="campo-errore" id={`${id}-errore`} role="alert">
          <Icona icona={CircleAlert} dimensione="s" />
          <span>{errore}</span>
        </span>
      )}
    </fieldset>
  );
}
