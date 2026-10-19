'use client';

import { CircleAlert } from 'lucide-react';
import { useId, type SelectHTMLAttributes } from 'react';
import { Icona } from './Icona';

type Opzione<V extends string> = { valore: V; etichetta: string };

type Props<V extends string> = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'id' | 'value' | 'onChange'
> & {
  etichetta: string;
  valore: V | '';
  opzioni: ReadonlyArray<Opzione<V>>;
  onCambia: (valore: V) => void;
  /** Testo della prima voce vuota, quando non c'è ancora una scelta. */
  segnaposto?: string | undefined;
  aiuto?: string | undefined;
  errore?: string | undefined;
};

/** Menu a tendina nativo con etichetta, aiuto ed errore come i campi di testo. */
export function Selezione<V extends string>({
  etichetta,
  valore,
  opzioni,
  onCambia,
  segnaposto,
  aiuto,
  errore,
  ...resto
}: Props<V>) {
  const id = useId();
  const descrittori = [errore ? `${id}-errore` : null, aiuto ? `${id}-aiuto` : null]
    .filter(Boolean)
    .join(' ');
  return (
    <div className="selezione">
      <label className="campo-etichetta" htmlFor={id}>
        {etichetta}
      </label>
      <select
        id={id}
        value={valore}
        aria-invalid={errore ? true : undefined}
        aria-describedby={descrittori || undefined}
        onChange={(evento) => {
          const scelta = opzioni.find((opzione) => opzione.valore === evento.target.value);
          if (scelta) onCambia(scelta.valore);
        }}
        {...resto}
      >
        {(segnaposto !== undefined || valore === '') && (
          <option value="" disabled>
            {segnaposto ?? ''}
          </option>
        )}
        {opzioni.map((opzione) => (
          <option key={opzione.valore} value={opzione.valore}>
            {opzione.etichetta}
          </option>
        ))}
      </select>
      {errore && (
        <span className="campo-errore" id={`${id}-errore`}>
          <Icona icona={CircleAlert} dimensione="s" />
          <span>{errore}</span>
        </span>
      )}
      {aiuto && (
        <span className="guida" id={`${id}-aiuto`}>
          {aiuto}
        </span>
      )}
    </div>
  );
}
