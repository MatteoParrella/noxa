'use client';

import { Info } from 'lucide-react';
import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { Avviso } from './Avviso';
import { Foglio } from './Foglio';
import { Icona } from './Icona';
import { Pulsante, type VariantePulsante } from './Pulsante';

type Props = {
  aperto: boolean;
  onChiudi: () => void;
  titolo: string;
  /** Riga sopra il titolo, per esempio "Operazione delicata · R-22". */
  sopratitolo?: string | undefined;
  /** Cosa succede dopo la conferma, scritto per esteso. */
  effetto: ReactNode;
  /** Contenuto aggiuntivo prima della motivazione (scelte, prima e dopo). */
  children?: ReactNode;
  etichettaMotivazione: string;
  aiutoMotivazione: string;
  erroreMotivazioneMancante: string;
  /** Falso quando la motivazione è facoltativa. */
  obbligatoria?: boolean;
  etichettaConferma: string;
  etichettaAnnulla: string;
  variante?: VariantePulsante;
  /** Esegue l'azione; un errore resta nel dialogo con la motivazione scritta. */
  onConferma: (motivazione: string) => Promise<void>;
  testoErrore: (errore: unknown) => string;
};

const MASSIMO = 500;

/**
 * Conferma con motivazione (design/F-40-moderazione-fonti): nessuna azione silenziosa. Si
 * chiude con Esc o Annulla; la motivazione resta nel registro.
 */
export function DialogoMotivazione({
  aperto,
  onChiudi,
  titolo,
  sopratitolo,
  effetto,
  children,
  etichettaMotivazione,
  aiutoMotivazione,
  erroreMotivazioneMancante,
  obbligatoria = true,
  etichettaConferma,
  etichettaAnnulla,
  variante = 'principale',
  onConferma,
  testoErrore,
}: Props) {
  const id = useId();
  const [motivazione, setMotivazione] = useState('');
  const [mancante, setMancante] = useState(false);
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function invia(evento: FormEvent) {
    evento.preventDefault();
    if (obbligatoria && motivazione.trim() === '') {
      setMancante(true);
      return;
    }
    setInCorso(true);
    setErrore(null);
    try {
      await onConferma(motivazione.trim());
      setMotivazione('');
    } catch (problema) {
      setErrore(testoErrore(problema));
    } finally {
      setInCorso(false);
    }
  }

  return (
    <Foglio aperto={aperto} onChiudi={onChiudi} titolo={titolo} forma="modale">
      <form className="flex flex-col gap-4" onSubmit={(e) => void invia(e)} noValidate>
        {sopratitolo && <p className="etichetta m-0">{sopratitolo}</p>}
        <div className="effetto">
          <Icona icona={Info} dimensione="s" />
          <div>{effetto}</div>
        </div>
        {children}
        <div className="motivazione">
          <div className="campo-riga">
            <label className="campo-etichetta" htmlFor={`${id}-motivazione`}>
              {etichettaMotivazione}
            </label>
            <span className="campo-conta" aria-hidden="true">
              {motivazione.length}/{MASSIMO}
            </span>
          </div>
          <textarea
            id={`${id}-motivazione`}
            value={motivazione}
            maxLength={MASSIMO}
            required={obbligatoria}
            aria-invalid={mancante ? true : undefined}
            aria-describedby={`${id}-aiuto${mancante ? ` ${id}-mancante` : ''}`}
            onChange={(evento) => {
              setMotivazione(evento.target.value);
              if (evento.target.value.trim()) setMancante(false);
            }}
          />
          {mancante && (
            <span className="campo-errore" id={`${id}-mancante`}>
              {erroreMotivazioneMancante}
            </span>
          )}
          <span className="guida" id={`${id}-aiuto`}>
            {aiutoMotivazione}
          </span>
        </div>
        {errore && (
          <Avviso tipo="errore" portaInVista>
            {errore}
          </Avviso>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Pulsante type="button" variante="secondario" onClick={onChiudi}>
            {etichettaAnnulla}
          </Pulsante>
          <Pulsante type="submit" variante={variante} caricamento={inCorso}>
            {etichettaConferma}
          </Pulsante>
        </div>
      </form>
    </Foglio>
  );
}
