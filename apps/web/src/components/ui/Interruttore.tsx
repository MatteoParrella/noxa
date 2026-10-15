'use client';

import { Check } from 'lucide-react';
import { useId } from 'react';
import { classi } from '@/lib/classi';
import { Icona } from './Icona';

type Props = {
  etichetta: string;
  attivo: boolean;
  onCambia: (attivo: boolean) => void;
  descrizione?: string;
  disabled?: boolean;
};

/** Interruttore on/off (role="switch"); lo stato acceso mostra anche un segno di spunta. */
export function Interruttore({
  etichetta,
  attivo,
  onCambia,
  descrizione,
  disabled = false,
}: Props) {
  const id = useId();
  return (
    <div className={classi('scelta justify-between', disabled && 'is-disabilitato')}>
      <span className="flex flex-col">
        <span id={`${id}-etichetta`}>{etichetta}</span>
        {descrizione && (
          <span id={`${id}-descrizione`} className="t-didascalia">
            {descrizione}
          </span>
        )}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={attivo}
        aria-labelledby={`${id}-etichetta`}
        aria-describedby={descrizione ? `${id}-descrizione` : undefined}
        disabled={disabled}
        onClick={() => onCambia(!attivo)}
        className={classi('interruttore', attivo && 'is-on', disabled && 'is-disabilitato')}
      >
        {attivo && <Icona icona={Check} className="segno" />}
      </button>
    </div>
  );
}
