'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Info } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Avviso } from '@/components/ui/Avviso';
import { Icona } from '@/components/ui/Icona';
import { Pulsante } from '@/components/ui/Pulsante';
import { Caricamento, ErroreConAzione } from '@/components/ui/Stati';
import { useToast } from '@/components/ui/Toast';
import { useOnline } from '@/lib/connessione';
import { ErroreRete } from '@/lib/errori';
import { messaggi } from '@/lib/messaggi/it';
import { registraErrore } from '@/lib/registro';
import { togliDestinatarioRitorno, type Persona } from './api';
import { Tratta } from './Componenti';
import { CHIAVI_RITORNO, useRitorni } from './dati';
import { leggiSessioneLocale, salvaSessioneLocale } from './dispositivo';
import { oraDi } from './formato';
import { azzeraMotore } from './motore';

const testi = messaggi.ritorno.chiLoVede;

/**
 * "Chi lo vede" del ritorno attivo (design/F-21-ritorno-sicuro §4): chi togli smette subito di
 * vedere la posizione; togliere l'ultima persona annulla il ritorno, e lo si dice prima.
 */
export function ChiLoVedeRitorno() {
  const ritorni = useRitorni();
  const online = useOnline();
  const client = useQueryClient();
  const mostraToast = useToast();
  const router = useRouter();
  const [daTogliere, setDaTogliere] = useState<Persona | null>(null);
  const mio = ritorni.data?.mio ?? null;

  const togli = useMutation({
    mutationFn: (persona: Persona) => togliDestinatarioRitorno(mio!.id, persona.id),
    onSuccess: (_, persona) => {
      setDaTogliere(null);
      if (mio && mio.destinatari.length <= 1) {
        if (leggiSessioneLocale()?.ritornoId === mio.id) salvaSessioneLocale(null);
        azzeraMotore();
        mostraToast({ testo: messaggi.ritorno.mio.annullato });
        router.push('/vivi/');
      } else {
        mostraToast({ testo: testi.tolto(persona.nome_visualizzato) });
      }
    },
    onError: (errore) => {
      if (!(errore instanceof ErroreRete)) registraErrore('destinatario del ritorno', errore);
    },
    onSettled: () => void client.invalidateQueries({ queryKey: CHIAVI_RITORNO.tutti }),
  });

  if (ritorni.isPending)
    return <Caricamento descrizione={messaggi.ritorno.amico.caricamento} righe={3} />;
  if (ritorni.isError) {
    return (
      <ErroreConAzione
        titolo={messaggi.ritorno.amico.errore}
        onRiprova={() => void ritorni.refetch()}
        riprovaInCorso={ritorni.isFetching}
      >
        {messaggi.vivi.errore.testo}
      </ErroreConAzione>
    );
  }
  if (!mio) {
    return (
      <div className="flex flex-col gap-4">
        <p className="t-corpo c-2 m-0">{messaggi.ritorno.dettaglio.nessunRitorno}</p>
        <Link className="btn btn-secondario" href="/vivi/">
          {messaggi.ritorno.dettaglio.torna}
        </Link>
      </div>
    );
  }
  const n = mio.destinatari.length;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Tratta mio={mio} livello={2} />
        <p className="ck-mono t-didascalia c-2 uppercase m-0">
          {testi.sottotitolo(oraDi(mio.arrivoPrevisto))}
        </p>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="etichetta m-0">{testi.destinatari}</h2>
        <span className="ck-mono t-didascalia c-2">{testi.conteggio(n)}</span>
      </div>
      <ul className="m-0 list-none p-0" aria-live="polite">
        {mio.destinatari.map((persona) =>
          daTogliere?.id === persona.id ? (
            <li key={persona.id}>
              <div className="rt-conferma" role="group" aria-labelledby={`rt-togli-${persona.id}`}>
                <b id={`rt-togli-${persona.id}`}>{testi.conferma(persona.nome_visualizzato)}</b>
                <p>{n <= 1 ? testi.confermaUltima : testi.confermaTesto}</p>
                {togli.isError && <Avviso tipo="errore">{testi.errore}</Avviso>}
                <div className="az">
                  <Pulsante
                    variante="secondario"
                    dimensione="s"
                    autoFocus
                    onClick={() => setDaTogliere(null)}
                  >
                    {testi.no}
                  </Pulsante>
                  <Pulsante
                    variante="secondario"
                    dimensione="s"
                    disabled={!online}
                    caricamento={togli.isPending}
                    onClick={() => togli.mutate(persona)}
                  >
                    {n <= 1 ? testi.siUltima : testi.si}
                  </Pulsante>
                </div>
              </div>
            </li>
          ) : (
            <li key={persona.id} className="rt-dest">
              <Avatar nome={persona.nome_visualizzato} foto={persona.avatar_path} decorativo />
              <span className="min-w-0">
                <span className="sel-nome">{persona.nome_visualizzato}</span>
                <span className="sel-username">@{persona.username}</span>
              </span>
              <Pulsante
                variante="secondario"
                dimensione="s"
                disabled={!online}
                aria-label={testi.togliPersona(persona.nome_visualizzato)}
                onClick={() => {
                  togli.reset();
                  setDaTogliere(persona);
                }}
              >
                {testi.togli}
              </Pulsante>
            </li>
          ),
        )}
      </ul>
      <p className="ck-motivo">
        <Icona icona={Info} dimensione="s" />
        {testi.nota}
      </p>
    </div>
  );
}
