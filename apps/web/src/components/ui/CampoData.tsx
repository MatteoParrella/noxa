'use client';

import { CalendarDays } from 'lucide-react';
import { useState } from 'react';
import { formattaData, formattaDigitazione, oggiARoma, type DataCalendario } from '@/lib/date';
import { messaggi } from '@/lib/messaggi/it';
import { Calendario } from './Calendario';
import { Campo } from './Campo';
import { Icona } from './Icona';
import { Pulsante } from './Pulsante';

type Props = {
  etichetta: string;
  valore: string;
  onCambia: (valore: string) => void;
  /** Data mostrata all'apertura del calendario quando il campo è vuoto. */
  dataIniziale: DataCalendario;
  /** Data valida già scritta nel campo, per aprire il calendario lì. */
  dataScelta?: DataCalendario | undefined;
  aiuto?: string;
  errore?: string | undefined;
  onInvio?: () => void;
};

/**
 * Data scritta come gg.mm.aaaa (tastiera numerica, i punti si aggiungono da soli) oppure
 * scelta da un calendario in un foglio dal basso (design/F-10-accesso).
 */
export function CampoData({
  etichetta,
  valore,
  onCambia,
  dataIniziale,
  dataScelta,
  aiuto,
  errore,
  onInvio,
}: Props) {
  const [aperto, setAperto] = useState(false);
  const testi = messaggi.registrazione.data;

  return (
    <>
      <Campo
        etichetta={etichetta}
        className="campo-data"
        inputMode="numeric"
        autoComplete="bday"
        placeholder={testi.segnaposto}
        value={valore}
        maxLength={10}
        {...(aiuto ? { aiuto } : {})}
        {...(errore ? { errore } : {})}
        onChange={(evento) => onCambia(formattaDigitazione(evento.target.value))}
        onKeyDown={(evento) => {
          if (evento.key === 'Enter') onInvio?.();
        }}
        suffisso={
          <Pulsante
            variante="neutro"
            soloIcona
            aria-label={testi.apriCalendario}
            onClick={() => setAperto(true)}
          >
            <Icona icona={CalendarDays} />
          </Pulsante>
        }
      />
      {aperto && (
        <Calendario
          titolo={messaggi.registrazione.calendario.titolo}
          iniziale={dataScelta ?? dataIniziale}
          scelta={dataScelta}
          massimo={oggiARoma()}
          annoMinimo={1901}
          testoConferma={() => messaggi.registrazione.calendario.conferma}
          onChiudi={() => setAperto(false)}
          onConferma={(data) => {
            onCambia(formattaData(data));
            setAperto(false);
          }}
        />
      )}
    </>
  );
}
