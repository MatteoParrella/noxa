import { Flag } from 'lucide-react';
import { Icona } from './Icona';

type Props = {
  /** Cosa si segnala, per l'etichetta accessibile: "Segnala l'evento Notte italo-disco". */
  oggetto: string;
  onSegnala: () => void;
};

/** Pulsante "Segnala", discreto ma sempre raggiungibile (R-50: al massimo due tocchi). */
export function PulsanteSegnala({ oggetto, onSegnala }: Props) {
  return (
    <button
      type="button"
      className="btn btn-segnala"
      onClick={onSegnala}
      aria-label={`Segnala ${oggetto}`}
    >
      <Icona icona={Flag} dimensione="s" />
      Segnala
    </button>
  );
}
