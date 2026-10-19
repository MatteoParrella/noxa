'use client';

import { useMutation } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Avviso } from '@/components/ui/Avviso';
import { Foglio } from '@/components/ui/Foglio';
import { Icona } from '@/components/ui/Icona';
import { Pulsante } from '@/components/ui/Pulsante';
import { useOnline } from '@/lib/connessione';
import { ErroreValidazione } from '@/lib/errori';
import { messaggi } from '@/lib/messaggi/it';
import { segnala, type MotivoSegnalazioneEvento } from './api';

type Voce = {
  chiave: string;
  etichetta: string;
  oggetto: { tipo: 'evento' | 'immagine_locale'; id: string };
  motivo: MotivoSegnalazioneEvento;
};

type Props = {
  io: string;
  eventoId: string;
  /** Locale della foto di copertina, se l'evento la mostra: anche la foto si segnala (ADR-0018). */
  fotoLocaleId: string | null;
  onChiudi: () => void;
};

/** Segnala l'evento in due tocchi (R-50): "Segnala" nel menu ⋯, poi il motivo, che invia subito. */
export function FoglioSegnalaEvento({ io, eventoId, fotoLocaleId, onChiudi }: Props) {
  const testi = messaggi.evento.segnalaFoglio;
  const online = useOnline();
  const [inviata, setInviata] = useState(false);

  const voci: Voce[] = [
    ...testi.motivi.map((motivo) => ({
      chiave: motivo.valore,
      etichetta: motivo.etichetta,
      oggetto: { tipo: 'evento' as const, id: eventoId },
      motivo: motivo.valore,
    })),
    ...(fotoLocaleId
      ? [
          {
            chiave: 'foto',
            etichetta: testi.foto,
            oggetto: { tipo: 'immagine_locale' as const, id: fotoLocaleId },
            motivo: 'contenuto_inappropriato' as const,
          },
        ]
      : []),
  ];

  const invio = useMutation({
    mutationFn: (voce: Voce) => segnala({ io, oggetto: voce.oggetto, motivo: voce.motivo }),
    onSuccess: () => setInviata(true),
  });

  if (inviata) {
    return (
      <Foglio aperto titolo={testi.inviata.titolo} onChiudi={onChiudi}>
        <div className="flex flex-col gap-4">
          <p className="t-corpo c-2 m-0">{testi.inviata.testo}</p>
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
    <Foglio aperto titolo={testi.titolo} onChiudi={onChiudi}>
      <div className="flex flex-col gap-4">
        {!online && <Avviso tipo="info">{messaggi.evento.offlineAzioni}</Avviso>}
        <p className="t-corpo-s c-2 m-0">{testi.spiegazione}</p>
        <div role="group" aria-label={testi.spiegazione}>
          {voci.map((voce) => {
            const inCorso = invio.isPending && invio.variables.chiave === voce.chiave;
            return (
              <button
                key={voce.chiave}
                type="button"
                className={inCorso ? 'motivo is-invio' : 'motivo'}
                disabled={!online || invio.isPending}
                aria-busy={inCorso || undefined}
                onClick={() => invio.mutate(voce)}
              >
                <span>{voce.etichetta}</span>
                <span className="fine">
                  {inCorso ? messaggi.segnala.invio : <Icona icona={ChevronRight} dimensione="s" />}
                </span>
              </button>
            );
          })}
        </div>
        {invio.isError && !limite && (
          <Avviso tipo="errore" titolo={messaggi.segnala.errore.titolo}>
            {messaggi.segnala.errore.testo}
          </Avviso>
        )}
        {limite && <Avviso tipo="avviso">{messaggi.segnala.limite}</Avviso>}
      </div>
    </Foglio>
  );
}
