'use client';

import { useMutation } from '@tanstack/react-query';
import { ChevronRight, Phone } from 'lucide-react';
import { useState } from 'react';
import { Avviso } from '@/components/ui/Avviso';
import { CasellaLunga } from '@/components/ui/CasellaLunga';
import { Foglio } from '@/components/ui/Foglio';
import { Icona } from '@/components/ui/Icona';
import { Pulsante } from '@/components/ui/Pulsante';
import { useOnline } from '@/lib/connessione';
import { ErroreValidazione, type ErroreDominio } from '@/lib/errori';
import { messaggi } from '@/lib/messaggi/it';
import { blocca, segnalaProfilo, type MotivoSegnalazione } from './api';

const LUNGHEZZA_MASSIMA = 1000;

type Props = {
  io: string;
  persona: { id: string; username: string };
  tipoOggetto?: 'profilo' | 'foto_profilo';
  onFatto: (bloccata: boolean) => void;
  onChiudi: () => void;
};

/**
 * Segnalazione in due tocchi (R-50): "Segnala" nel menu ⋯, poi il motivo, che invia subito.
 * Testo e "Blocca anche" si compilano prima, se si vuole. Resta anonima per chi è segnalato.
 */
export function FoglioSegnala({ io, persona, tipoOggetto = 'profilo', onFatto, onChiudi }: Props) {
  const testi = messaggi.segnala;
  const online = useOnline();
  const [dettagli, setDettagli] = useState('');
  const [bloccaAnche, setBloccaAnche] = useState(false);
  const [inviato, setInviato] = useState<MotivoSegnalazione | null>(null);

  const invio = useMutation({
    mutationFn: async (motivo: MotivoSegnalazione) => {
      await segnalaProfilo({ io, profilo: persona.id, tipoOggetto, motivo, dettagli });
      if (bloccaAnche) await blocca(io, persona.id);
    },
    onSuccess: (_risultato, motivo) => setInviato(motivo),
  });

  const chiudi = () => (inviato ? onFatto(bloccaAnche) : onChiudi());

  if (inviato) {
    const rischio = inviato === 'adescamento_o_rischio_minore';
    return (
      <Foglio
        aperto
        titolo={rischio ? testi.rischio.titolo : testi.inviata.titolo}
        onChiudi={chiudi}
      >
        <div className="flex flex-col gap-4">
          <p className="t-corpo c-2 m-0">{rischio ? testi.rischio.testo : testi.inviata.testo}</p>
          {rischio && (
            <a className="btn btn-pericolo btn-pieno" href="tel:112">
              <Icona icona={Phone} />
              {testi.rischio.chiama}
            </a>
          )}
          <Pulsante variante="secondario" pieno onClick={chiudi}>
            {messaggi.comune.chiudi}
          </Pulsante>
        </div>
      </Foglio>
    );
  }

  const limite =
    invio.error instanceof ErroreValidazione && invio.error.codice === 'troppe_segnalazioni_oggi';
  const errore = invio.error as ErroreDominio | null;

  return (
    <Foglio
      aperto
      titolo={
        tipoOggetto === 'foto_profilo'
          ? testi.titoloFoto(persona.username)
          : testi.titolo(persona.username)
      }
      onChiudi={onChiudi}
    >
      <div className="flex flex-col gap-4">
        {!online && <Avviso tipo="info">{testi.offline}</Avviso>}
        <p className="t-corpo-s c-2 m-0">{testi.spiegazione}</p>
        <div className="campo-area">
          <label className="campo-riga" htmlFor="segnala-dettagli">
            <span className="campo-etichetta">
              {testi.dettagli} <span className="campo-opz">(facoltativo)</span>
            </span>
            <span className="campo-conta" aria-hidden="true">
              {dettagli.length}/{LUNGHEZZA_MASSIMA}
            </span>
          </label>
          <textarea
            id="segnala-dettagli"
            maxLength={LUNGHEZZA_MASSIMA}
            value={dettagli}
            onChange={(evento) => setDettagli(evento.target.value)}
          />
        </div>
        <CasellaLunga selezionata={bloccaAnche} onCambia={setBloccaAnche}>
          {testi.bloccaAnche}
        </CasellaLunga>
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
                  {inCorso ? testi.invio : <Icona icona={ChevronRight} dimensione="s" />}
                </span>
              </button>
            );
          })}
        </div>
        {errore && !limite && (
          <Avviso tipo="errore" titolo={testi.errore.titolo}>
            {testi.errore.testo}
          </Avviso>
        )}
        {limite && <Avviso tipo="avviso">{testi.limite}</Avviso>}
      </div>
    </Foglio>
  );
}
