'use client';

import { useMutation } from '@tanstack/react-query';
import { ChevronRight, Phone } from 'lucide-react';
import { useState } from 'react';
import { Avviso } from '@/components/ui/Avviso';
import { Foglio } from '@/components/ui/Foglio';
import { Icona } from '@/components/ui/Icona';
import { Pulsante } from '@/components/ui/Pulsante';
import { useOnline } from '@/lib/connessione';
import { ErroreValidazione } from '@/lib/errori';
import { messaggi } from '@/lib/messaggi/it';
import { segnalaTesto, type MotivoSegnalazioneTesto, type TipoSegnalabile } from './api';

const LUNGHEZZA_MASSIMA = 1000;

type Props = {
  io: string;
  tipo: TipoSegnalabile;
  oggetto: string;
  onChiudi: () => void;
};

/**
 * Segnala il nome del gruppo o i testi della serata (R-16, R-50): il motivo invia subito, i
 * dettagli sono facoltativi e la segnalazione resta anonima.
 */
export function FoglioSegnalaTesto({ io, tipo, oggetto, onChiudi }: Props) {
  const testi = messaggi.gruppi.segnala;
  const comuni = messaggi.segnala;
  const online = useOnline();
  const [dettagli, setDettagli] = useState('');
  const [inviato, setInviato] = useState<MotivoSegnalazioneTesto | null>(null);

  const invio = useMutation({
    mutationFn: (motivo: MotivoSegnalazioneTesto) =>
      segnalaTesto({ io, tipo, oggetto, motivo, dettagli }),
    onSuccess: (_esito, motivo) => setInviato(motivo),
  });

  if (inviato) {
    const rischio = inviato === 'adescamento_o_rischio_minore';
    return (
      <Foglio
        aperto
        titolo={rischio ? comuni.rischio.titolo : comuni.inviata.titolo}
        onChiudi={onChiudi}
      >
        <div className="flex flex-col gap-4">
          <p className="t-corpo c-2 m-0">{rischio ? comuni.rischio.testo : comuni.inviata.testo}</p>
          {rischio && (
            <a className="btn btn-pericolo btn-pieno" href="tel:112">
              <Icona icona={Phone} />
              {comuni.rischio.chiama}
            </a>
          )}
          <Pulsante variante="secondario" pieno onClick={onChiudi}>
            {messaggi.comune.chiudi}
          </Pulsante>
        </div>
      </Foglio>
    );
  }

  const limite =
    invio.error instanceof ErroreValidazione && invio.error.codice === 'troppe_segnalazioni_oggi';

  return (
    <Foglio
      aperto
      titolo={tipo === 'gruppo' ? testi.titoloGruppo : testi.titoloSerata}
      onChiudi={onChiudi}
    >
      <div className="flex flex-col gap-4">
        {!online && <Avviso tipo="info">{comuni.offline}</Avviso>}
        <p className="t-corpo-s c-2 m-0">{testi.spiegazione}</p>
        <div className="campo-area">
          <label className="campo-riga" htmlFor="segnala-testo-dettagli">
            <span className="campo-etichetta">
              {comuni.dettagli} <span className="campo-opz">(facoltativo)</span>
            </span>
            <span className="campo-conta" aria-hidden="true">
              {dettagli.length}/{LUNGHEZZA_MASSIMA}
            </span>
          </label>
          <textarea
            id="segnala-testo-dettagli"
            maxLength={LUNGHEZZA_MASSIMA}
            value={dettagli}
            onChange={(evento) => setDettagli(evento.target.value)}
          />
        </div>
        <div role="group" aria-label={testi.spiegazione}>
          {testi.motivi.map((motivo) => {
            const inCorso = invio.isPending && invio.variables === motivo.valore;
            return (
              <button
                key={motivo.valore}
                type="button"
                className={inCorso ? 'motivo is-invio' : 'motivo'}
                disabled={!online || invio.isPending}
                aria-busy={inCorso || undefined}
                onClick={() => invio.mutate(motivo.valore)}
              >
                <span>{motivo.etichetta}</span>
                <span className="fine">
                  {inCorso ? comuni.invio : <Icona icona={ChevronRight} dimensione="s" />}
                </span>
              </button>
            );
          })}
        </div>
        {invio.isError && !limite && (
          <Avviso tipo="errore" titolo={comuni.errore.titolo}>
            {comuni.errore.testo}
          </Avviso>
        )}
        {limite && <Avviso tipo="avviso">{comuni.limite}</Avviso>}
      </div>
    </Foglio>
  );
}
