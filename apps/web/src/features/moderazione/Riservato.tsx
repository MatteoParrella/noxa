'use client';

import { EyeOff, ShieldAlert } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { Avviso } from '@/components/ui/Avviso';
import { Campo } from '@/components/ui/Campo';
import { Foglio } from '@/components/ui/Foglio';
import { Icona } from '@/components/ui/Icona';
import { Pulsante } from '@/components/ui/Pulsante';
import { classi } from '@/lib/classi';
import { messaggi } from '@/lib/messaggi/it';
import { testoErrore } from './formato';

const testi = messaggi.moderazione;

/**
 * Immagine segnalata o sospetta, sfocata finché il moderatore non sceglie "Mostra" (design
 * F-40, R-69). Nessun pulsante per scaricarla o inoltrarla (R-55).
 */
export function ImmagineSfocata({
  url,
  alt,
  forma = 'quadrata',
  didascalia,
}: {
  url: string | null;
  alt: string;
  forma?: 'quadrata' | 'flyer' | 'largo';
  didascalia?: string | undefined;
}) {
  const v = testi.dettaglioSegnalazione.sfocata;
  const [mostrata, setMostrata] = useState(false);
  return (
    <figure className="m-0">
      <div
        className={classi(
          'sfocata',
          forma === 'flyer' && 'flyer',
          forma === 'largo' && 'largo',
          mostrata && 'is-mostrata',
        )}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={mostrata ? alt : ''} draggable={false} />
        ) : (
          <div className="sfocata-velo">{v.nessuna}</div>
        )}
        {url && !mostrata && (
          <div className="sfocata-velo">
            <Icona icona={EyeOff} />
            <span>{v.testo}</span>
            <Pulsante variante="secondario" dimensione="s" onClick={() => setMostrata(true)}>
              {v.mostra}
            </Pulsante>
          </div>
        )}
      </div>
      {url && mostrata && (
        <Pulsante
          className="mt-2"
          variante="testo"
          dimensione="s"
          onClick={() => setMostrata(false)}
        >
          {v.nascondi}
        </Pulsante>
      )}
      {didascalia && <figcaption className="sfocata-dida">{didascalia}</figcaption>}
    </figure>
  );
}

/** Anteprima del messaggio che riceverà una persona (DSA art. 17): titolo e motivazione. */
export function AnteprimaMessaggio({
  destinatario,
  titolo,
  motivazione,
  reclamo = true,
}: {
  destinatario: string;
  titolo: string;
  motivazione: string;
  reclamo?: boolean;
}) {
  const a = testi.dettaglioSegnalazione.anteprima;
  return (
    <div className="msg-anteprima" aria-live="polite">
      <span className="msg-testa">
        {a.titolo} · {destinatario}
        <b>{a.notifica}</b>
      </span>
      <strong>{titolo}</strong>
      <span className={motivazione ? undefined : 'c-3'}>{motivazione || a.vuota}</span>
      {reclamo && <span className="msg-piede">{a.reclamo}</span>}
    </div>
  );
}

/**
 * Escalation alle autorità (R-55, SAFETY_PRIVACY.md §11): conferma in due passaggi, prima
 * cosa succede, poi motivazione e parola di conferma. Nessun messaggio all'account coinvolto.
 */
export function DialogoEscalation({
  aperto,
  onChiudi,
  sopratitolo,
  onConferma,
}: {
  aperto: boolean;
  onChiudi: () => void;
  sopratitolo: string;
  onConferma: (motivazione: string) => Promise<void>;
}) {
  const e = testi.escalation;
  const id = useId();
  const [passo, setPasso] = useState<1 | 2>(1);
  const [motivazione, setMotivazione] = useState('');
  const [parola, setParola] = useState('');
  const [mancante, setMancante] = useState<'motivazione' | 'parola' | null>(null);
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  function chiudi() {
    setPasso(1);
    setMotivazione('');
    setParola('');
    setMancante(null);
    setErrore(null);
    onChiudi();
  }

  async function invia(evento: FormEvent) {
    evento.preventDefault();
    if (passo === 1) {
      setPasso(2);
      return;
    }
    if (!motivazione.trim()) {
      setMancante('motivazione');
      return;
    }
    if (parola.trim() !== e.parola) {
      setMancante('parola');
      return;
    }
    setInCorso(true);
    setErrore(null);
    try {
      await onConferma(motivazione.trim());
      chiudi();
    } catch (problema) {
      setErrore(testoErrore(problema));
    } finally {
      setInCorso(false);
    }
  }

  return (
    <Foglio aperto={aperto} onChiudi={chiudi} titolo={e.titolo} forma="modale">
      <form className="flex flex-col gap-4" onSubmit={(ev) => void invia(ev)} noValidate>
        <p className="etichetta m-0">{sopratitolo}</p>
        <div className="passi-escalation" aria-label={e.passo(passo)}>
          <i className="is-on" />
          <i className={passo === 2 ? 'is-on' : undefined} />
          <span>{e.passo(passo)}</span>
        </div>
        {passo === 1 ? (
          <>
            <p className="m-0 font-medium">
              <Icona icona={ShieldAlert} dimensione="s" className="c-errore" /> {e.cosaSuccede}
            </p>
            <ul className="elenco-effetti">
              {e.effetti.map((effetto) => (
                <li key={effetto}>{effetto}</li>
              ))}
            </ul>
            <p className="guida m-0">{e.nessunDownload}</p>
          </>
        ) : (
          <>
            <div className="motivazione">
              <label className="campo-etichetta" htmlFor={`${id}-motivazione`}>
                {e.motivazione}
              </label>
              <textarea
                id={`${id}-motivazione`}
                value={motivazione}
                maxLength={500}
                required
                aria-invalid={mancante === 'motivazione' ? true : undefined}
                aria-describedby={mancante === 'motivazione' ? `${id}-manca` : undefined}
                onChange={(ev) => setMotivazione(ev.target.value)}
              />
              {mancante === 'motivazione' && (
                <span className="campo-errore" id={`${id}-manca`}>
                  {e.motivazioneMancante}
                </span>
              )}
            </div>
            <Campo
              etichetta={e.digita(e.parola)}
              className="parola-conferma"
              value={parola}
              autoComplete="off"
              spellCheck={false}
              errore={mancante === 'parola' ? e.parolaErrata(e.parola) : undefined}
              onChange={(ev) => setParola(ev.target.value)}
            />
          </>
        )}
        {errore && (
          <Avviso tipo="errore" portaInVista>
            {errore}
          </Avviso>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Pulsante
            type="button"
            variante="secondario"
            onClick={passo === 1 ? chiudi : () => setPasso(1)}
          >
            {passo === 1 ? testi.comune.annulla : e.indietro}
          </Pulsante>
          <Pulsante
            type="submit"
            variante="pericolo"
            className={passo === 2 ? 'btn-grave' : undefined}
            caricamento={inCorso}
          >
            {passo === 1 ? e.avanti : e.conferma}
          </Pulsante>
        </div>
      </form>
    </Foglio>
  );
}
