'use client';

import { CircleAlert } from 'lucide-react';
import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { classi } from '@/lib/classi';
import { Icona } from './Icona';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  etichetta: string;
  aiuto?: string;
  /** Messaggio d'errore con il suggerimento di correzione (DESIGN.md §4). */
  errore?: string;
  facoltativo?: boolean;
  /** Elemento prima del testo, per esempio l'icona della ricerca. */
  prefisso?: ReactNode;
  /** Elemento dopo il testo, per esempio un pulsante per cancellare. */
  suffisso?: ReactNode;
};

export function Campo({
  etichetta,
  aiuto,
  errore,
  facoltativo = false,
  prefisso,
  suffisso,
  disabled,
  className,
  type = 'text',
  ...resto
}: Props) {
  const id = useId();
  const idAiuto = `${id}-aiuto`;
  const idErrore = `${id}-errore`;
  const descrittori = [errore ? idErrore : null, aiuto ? idAiuto : null].filter(Boolean).join(' ');

  return (
    <div className={classi('campo', className)}>
      <label className="campo-etichetta" htmlFor={id}>
        {etichetta}
        {facoltativo && <span className="campo-opz"> (facoltativo)</span>}
      </label>
      <div
        className={classi(
          'campo-box',
          type === 'search' && 'campo-ricerca',
          errore && 'is-errore',
          disabled && 'is-disabilitato',
        )}
      >
        {prefisso}
        <input
          id={id}
          type={type}
          disabled={disabled}
          aria-invalid={errore ? true : undefined}
          aria-describedby={descrittori || undefined}
          {...resto}
        />
        {suffisso}
      </div>
      {errore && (
        <span className="campo-errore" id={idErrore}>
          <Icona icona={CircleAlert} dimensione="s" />
          <span>{errore}</span>
        </span>
      )}
      {aiuto && (
        <span className="campo-aiuto" id={idAiuto}>
          {aiuto}
        </span>
      )}
    </div>
  );
}
