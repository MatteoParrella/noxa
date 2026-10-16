'use client';

import { CalendarDays } from 'lucide-react';
import { useRef, useState, type KeyboardEvent } from 'react';
import {
  formattaData,
  formattaDigitazione,
  giorniNelMese,
  NOMI_MESI,
  oggiARoma,
  type DataCalendario,
} from '@/lib/date';
import { messaggi } from '@/lib/messaggi/it';
import { Campo } from './Campo';
import { Foglio } from './Foglio';
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
          iniziale={dataScelta ?? dataIniziale}
          scelta={dataScelta}
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

type PropsCalendario = {
  iniziale: DataCalendario;
  scelta: DataCalendario | undefined;
  onChiudi: () => void;
  onConferma: (data: DataCalendario) => void;
};

function Calendario({ iniziale, scelta, onChiudi, onConferma }: PropsCalendario) {
  const testi = messaggi.registrazione.calendario;
  const oggi = oggiARoma();
  const [vista, setVista] = useState({ anno: iniziale.anno, mese: iniziale.mese });
  const [selezione, setSelezione] = useState<DataCalendario | undefined>(scelta);
  const [attivo, setAttivo] = useState(scelta?.giorno ?? 1);
  const griglia = useRef<HTMLDivElement>(null);

  const giorni = giorniNelMese(vista.anno, vista.mese);
  // Lunedì = 0 (settimana italiana).
  const primo = (new Date(Date.UTC(vista.anno, vista.mese - 1, 1)).getUTCDay() + 6) % 7;
  const giornoAttivo = Math.min(attivo, giorni);
  const futuro = (giorno: number) =>
    vista.anno > oggi.anno ||
    (vista.anno === oggi.anno &&
      (vista.mese > oggi.mese || (vista.mese === oggi.mese && giorno > oggi.giorno)));
  const anni = Array.from({ length: oggi.anno - 1900 }, (_, indice) => oggi.anno - indice);

  const sposta = (giorno: number) => {
    const limitato = Math.max(1, Math.min(giorni, giorno));
    setAttivo(limitato);
    requestAnimationFrame(() => {
      griglia.current?.querySelector<HTMLButtonElement>(`[data-giorno="${limitato}"]`)?.focus();
    });
  };

  const tasti = (evento: KeyboardEvent<HTMLButtonElement>) => {
    const spostamenti: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    const delta = spostamenti[evento.key];
    if (delta !== undefined) {
      evento.preventDefault();
      sposta(giornoAttivo + delta);
    } else if (evento.key === 'Home') {
      evento.preventDefault();
      sposta(1);
    } else if (evento.key === 'End') {
      evento.preventDefault();
      sposta(giorni);
    }
  };

  return (
    <Foglio
      aperto
      onChiudi={onChiudi}
      titolo={testi.titolo}
      accessorio={
        <span className="t-mono-dato c-2" aria-live="polite">
          {selezione ? formattaData(selezione) : ''}
        </span>
      }
    >
      <div className="calendario-selettori">
        <select
          className="calendario-selettore"
          aria-label={testi.mese}
          value={vista.mese}
          onChange={(evento) => setVista({ ...vista, mese: Number(evento.target.value) })}
        >
          {NOMI_MESI.map((nome, indice) => (
            <option key={nome} value={indice + 1}>
              {nome.charAt(0).toUpperCase() + nome.slice(1)}
            </option>
          ))}
        </select>
        <select
          className="calendario-selettore mono"
          aria-label={testi.anno}
          value={vista.anno}
          onChange={(evento) => setVista({ ...vista, anno: Number(evento.target.value) })}
        >
          {anni.map((anno) => (
            <option key={anno} value={anno}>
              {anno}
            </option>
          ))}
        </select>
      </div>
      <div
        ref={griglia}
        className="calendario-griglia"
        role="group"
        aria-label={`${NOMI_MESI[vista.mese - 1] ?? ''} ${vista.anno}`}
      >
        {testi.giorniSettimana.map((nome) => (
          <span key={nome} className="giorno-settimana" aria-hidden="true">
            {nome}
          </span>
        ))}
        {Array.from({ length: primo }, (_, indice) => (
          <span key={`vuoto-${indice}`} aria-hidden="true" />
        ))}
        {Array.from({ length: giorni }, (_, indice) => {
          const giorno = indice + 1;
          const selezionato =
            selezione?.anno === vista.anno &&
            selezione.mese === vista.mese &&
            selezione.giorno === giorno;
          return (
            <button
              key={giorno}
              type="button"
              data-giorno={giorno}
              className="calendario-giorno"
              aria-label={`${giorno} ${NOMI_MESI[vista.mese - 1] ?? ''} ${vista.anno}`}
              aria-pressed={selezionato}
              tabIndex={giorno === giornoAttivo ? 0 : -1}
              disabled={futuro(giorno)}
              onKeyDown={tasti}
              onClick={() => {
                setAttivo(giorno);
                setSelezione({ anno: vista.anno, mese: vista.mese, giorno });
              }}
            >
              {giorno}
            </button>
          );
        })}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Pulsante variante="secondario" onClick={onChiudi}>
          {testi.annulla}
        </Pulsante>
        <Pulsante
          variante="principale"
          disabled={!selezione}
          onClick={() => {
            if (selezione) onConferma(selezione);
          }}
        >
          {testi.conferma}
        </Pulsante>
      </div>
    </Foglio>
  );
}
