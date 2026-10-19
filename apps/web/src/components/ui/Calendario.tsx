'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import {
  confrontaDate,
  formattaData,
  giorniNelMese,
  NOMI_MESI,
  type DataCalendario,
} from '@/lib/date';
import { messaggi } from '@/lib/messaggi/it';
import { Foglio } from './Foglio';
import { Pulsante } from './Pulsante';

type Props = {
  titolo: string;
  iniziale: DataCalendario;
  scelta: DataCalendario | undefined;
  /** Primo e ultimo giorno che si possono scegliere; gli altri sono spenti e barrati. */
  minimo?: DataCalendario;
  massimo?: DataCalendario;
  /** Primo anno del selettore (l'ultimo è quello del massimo, o del minimo + 1). */
  annoMinimo: number;
  testoConferma: (selezione: DataCalendario | undefined) => string;
  onChiudi: () => void;
  onConferma: (data: DataCalendario) => void;
};

/**
 * Calendario in un foglio dal basso (design/F-10-accesso, design/F-01-scopri): mese e anno
 * scelti dai selettori, giorni navigabili con le frecce, Inizio e Fine.
 */
export function Calendario({
  titolo,
  iniziale,
  scelta,
  minimo,
  massimo,
  annoMinimo,
  testoConferma,
  onChiudi,
  onConferma,
}: Props) {
  const testi = messaggi.registrazione.calendario;
  const [vista, setVista] = useState({ anno: iniziale.anno, mese: iniziale.mese });
  const [selezione, setSelezione] = useState<DataCalendario | undefined>(scelta);
  const [attivo, setAttivo] = useState(scelta?.giorno ?? iniziale.giorno);
  const griglia = useRef<HTMLDivElement>(null);

  const giorni = giorniNelMese(vista.anno, vista.mese);
  // Lunedì = 0 (settimana italiana).
  const primo = (new Date(Date.UTC(vista.anno, vista.mese - 1, 1)).getUTCDay() + 6) % 7;
  const giornoAttivo = Math.min(attivo, giorni);
  const fuoriLimite = (giorno: number) => {
    const data = { anno: vista.anno, mese: vista.mese, giorno };
    return (
      (minimo !== undefined && confrontaDate(data, minimo) < 0) ||
      (massimo !== undefined && confrontaDate(data, massimo) > 0)
    );
  };
  const annoMassimo = massimo?.anno ?? (minimo ? minimo.anno + 1 : iniziale.anno);
  const anni = Array.from(
    { length: annoMassimo - annoMinimo + 1 },
    (_, indice) => annoMassimo - indice,
  );

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
      titolo={titolo}
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
              disabled={fuoriLimite(giorno)}
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
          {testoConferma(selezione)}
        </Pulsante>
      </div>
    </Foglio>
  );
}
