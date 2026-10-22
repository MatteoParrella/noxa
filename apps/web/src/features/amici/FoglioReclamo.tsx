'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Avviso } from '@/components/ui/Avviso';
import { Foglio } from '@/components/ui/Foglio';
import { Pulsante } from '@/components/ui/Pulsante';
import { useOnline } from '@/lib/connessione';
import { converti, ErroreValidazione } from '@/lib/errori';
import { messaggi } from '@/lib/messaggi/it';
import { presentaReclamo } from './api';
import { CHIAVE_SEGNALAZIONI } from './dati';

const LUNGHEZZA_MASSIMA = 1000;

type Props = {
  azioneId: string;
  onFatto: () => void;
  onChiudi: () => void;
};

/**
 * Form per presentare un reclamo su una decisione di moderazione (DSA art. 20). Aperto
 * dal pulsante nella riga della segnalazione in MieSegnalazioni.
 */
export function FoglioReclamo({ azioneId, onFatto, onChiudi }: Props) {
  const testi = messaggi.reclamo;
  const online = useOnline();
  const client = useQueryClient();
  const [testo, setTesto] = useState('');
  const [inviato, setInviato] = useState(false);

  const invio = useMutation({
    mutationFn: () => presentaReclamo(azioneId, testo),
    onSuccess: () => {
      setInviato(true);
      void client.invalidateQueries({ queryKey: CHIAVE_SEGNALAZIONI });
    },
  });

  if (inviato) {
    return (
      <Foglio aperto titolo={testi.titolo} onChiudi={onFatto}>
        <div className="flex flex-col gap-4">
          <p className="t-corpo c-2 m-0">{testi.successo.titolo}</p>
          <p className="c-2 m-0">{testi.successo.testo}</p>
          <Pulsante variante="secondario" pieno onClick={onFatto}>
            {messaggi.comune.chiudi}
          </Pulsante>
        </div>
      </Foglio>
    );
  }

  const erroreMsg = messaggioErrore(invio.error);

  const invia = (e: FormEvent) => {
    e.preventDefault();
    if (testo.trim().length === 0) return;
    invio.mutate();
  };

  return (
    <Foglio aperto titolo={testi.titolo} onChiudi={onChiudi}>
      <form noValidate onSubmit={invia} className="flex flex-col gap-4">
        {!online && <Avviso tipo="info">{messaggi.comune.erroreRete.testo}</Avviso>}
        <p className="t-corpo-s c-2 m-0">{testi.descrizione}</p>
        <div className="campo-area">
          <label className="campo-riga" htmlFor="reclamo-testo">
            <span className="campo-etichetta">{testi.campo}</span>
            <span className="campo-conta" aria-hidden="true">
              {testo.length}/{LUNGHEZZA_MASSIMA}
            </span>
          </label>
          <textarea
            id="reclamo-testo"
            maxLength={LUNGHEZZA_MASSIMA}
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
            rows={5}
            aria-describedby="reclamo-aiuto"
          />
          <p id="reclamo-aiuto" className="campo-aiuto">
            {testi.aiuto}
          </p>
        </div>
        {erroreMsg && <Avviso tipo="errore">{erroreMsg}</Avviso>}
        <Pulsante
          variante="principale"
          dimensione="l"
          pieno
          type="submit"
          disabled={testo.trim().length === 0 || invio.isPending || !online}
          caricamento={invio.isPending}
        >
          {invio.isPending ? testi.invio : testi.invia}
        </Pulsante>
      </form>
    </Foglio>
  );
}

function messaggioErrore(err: unknown): string | null {
  if (!err) return null;
  const errore = converti(err as Parameters<typeof converti>[0]);
  if (errore instanceof ErroreValidazione) {
    if (errore.codice === 'reclamo_fuori_termine') return messaggi.reclamo.errori.scaduto;
    if (errore.codice === 'reclamo_gia_presentato') return messaggi.reclamo.errori.giaInviato;
    if (errore.codice === 'reclamo_non_ammesso') return messaggi.reclamo.errori.generico;
  }
  return messaggi.reclamo.errori.generico;
}
