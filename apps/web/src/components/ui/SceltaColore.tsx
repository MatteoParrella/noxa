'use client';

import { Check } from 'lucide-react';
import { useId } from 'react';
import { COLORI_GRUPPO, NOMI_COLORI, type ColoreGruppo } from '@/lib/coloriGruppo';
import { Icona } from './Icona';

/** Scelta del colore di un gruppo: pulsanti di opzione con il nome del colore (WCAG 1.4.1). */
export function SceltaColore({
  etichetta,
  valore,
  onCambia,
}: {
  etichetta: string;
  valore: ColoreGruppo;
  onCambia: (colore: ColoreGruppo) => void;
}) {
  const id = useId();
  return (
    <fieldset className="scelta-colore">
      <legend className="campo-etichetta">{etichetta}</legend>
      <div className="scelta-colore-voci">
        {COLORI_GRUPPO.map((colore) => (
          <label key={colore} className="scelta-colore-voce" data-colore={colore}>
            <input
              type="radio"
              name={id}
              value={colore}
              checked={valore === colore}
              onChange={() => onCambia(colore)}
              className="scelta-colore-input"
            />
            <span className="scelta-colore-campione" aria-hidden="true">
              {valore === colore && <Icona icona={Check} dimensione="s" />}
            </span>
            <span className="sr-only">{NOMI_COLORI[colore]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
