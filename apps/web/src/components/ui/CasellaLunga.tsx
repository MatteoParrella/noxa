import { Check } from 'lucide-react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { classi } from '@/lib/classi';
import { Icona } from './Icona';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange' | 'children'> & {
  selezionata: boolean;
  onCambia: (selezionata: boolean) => void;
  errore?: boolean;
  children: ReactNode;
};

/**
 * Casella con un testo lungo che può contenere link (consensi). È una vera casella di
 * controllo: tutta la riga è l'area di tocco e il link resta un elemento a sé.
 */
export function CasellaLunga({ selezionata, onCambia, errore = false, children, ...resto }: Props) {
  return (
    <label className={classi('casella-lunga', errore && 'is-errore')}>
      <input
        type="checkbox"
        checked={selezionata}
        aria-invalid={errore || undefined}
        onChange={(evento) => onCambia(evento.target.checked)}
        {...resto}
      />
      <span className={classi('casella', selezionata && 'is-on')} aria-hidden="true">
        <Icona icona={Check} dimensione="s" />
      </span>
      <span>{children}</span>
    </label>
  );
}
