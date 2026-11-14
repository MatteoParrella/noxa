'use client';

import { CalendarPlus, Check, Eye, EyeOff, Star } from 'lucide-react';
import { useId, useState } from 'react';
import { classi } from '@/lib/classi';
import { messaggi } from '@/lib/messaggi/it';
import { Icona } from './Icona';

export type SceltaPartecipazione = 'interessato' | 'partecipo' | null;

type Props = {
  scelta: SceltaPartecipazione;
  visibile: boolean;
  onScegli: (scelta: SceltaPartecipazione) => void;
  onVisibilita: (visibile: boolean) => void;
  disattivato?: boolean;
  /** Nota sotto i controlli, per esempio il motivo per cui sono spenti. */
  nota?: string;
};

/**
 * Mi interessa / Partecipo (F-05): al massimo una scelta, un tocco la imposta e un secondo
 * tocco la toglie. Lo stato è sempre scritto, non solo colorato; la visibilità agli amici vale
 * per questo evento (R-67).
 */
export function SelettorePartecipazione({
  scelta,
  visibile,
  onScegli,
  onVisibilita,
  disattivato = false,
  nota,
}: Props) {
  const testi = messaggi.evento.partecipazione;
  const id = useId();
  // Il battito parte solo dopo un tocco, non quando la schermata si apre con la scelta già fatta.
  const [appenaScelto, setAppenaScelto] = useState(false);
  const scegliPartecipo = () => {
    const nuova = scelta === 'partecipo' ? null : 'partecipo';
    setAppenaScelto(nuova === 'partecipo');
    // Vibrazione breve dove il dispositivo la offre; altrove non succede nulla.
    if (nuova === 'partecipo' && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(12);
    }
    onScegli(nuova);
  };
  const stato =
    scelta === 'partecipo'
      ? testi.statoPartecipo
      : scelta === 'interessato'
        ? testi.statoInteressa
        : testi.nessuna;

  return (
    <div className="flex flex-col gap-2">
      <div className="partecipa" role="group" aria-label={testi.gruppo}>
        <button
          type="button"
          className={classi('partecipa-opz', scelta === 'interessato' && 'is-on')}
          aria-pressed={scelta === 'interessato'}
          disabled={disattivato}
          onClick={() => {
            setAppenaScelto(false);
            onScegli(scelta === 'interessato' ? null : 'interessato');
          }}
        >
          <Icona icona={Star} />
          {testi.interessa}
        </button>
        <button
          type="button"
          className={classi(
            'partecipa-opz forte',
            scelta === 'partecipo' && 'is-on',
            scelta === 'partecipo' && appenaScelto && 'appena-scelto',
          )}
          aria-pressed={scelta === 'partecipo'}
          disabled={disattivato}
          onClick={scegliPartecipo}
        >
          <Icona icona={scelta === 'partecipo' ? Check : CalendarPlus} />
          {testi.partecipo}
        </button>
      </div>
      <span className="t-didascalia" role="status">
        {stato}
      </span>
      <div className="visibilita">
        <Icona icona={visibile ? Eye : EyeOff} className="c-2" />
        <span className="testo" id={`${id}-testo`}>
          <b>{visibile ? testi.visibile : testi.soloTe}</b>
          <span>{visibile ? testi.visibileTesto : testi.soloTeTesto}</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={visibile}
          aria-label={testi.visibile}
          aria-describedby={`${id}-testo`}
          disabled={disattivato}
          className={classi('interruttore', visibile && 'is-on', disattivato && 'is-disabilitato')}
          onClick={() => onVisibilita(!visibile)}
        >
          {visibile && <Icona icona={Check} className="segno" />}
        </button>
      </div>
      {nota && <p className="t-didascalia m-0">{nota}</p>}
    </div>
  );
}
