'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Info, MapPin } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Icona } from '@/components/ui/Icona';
import { Pulsante } from '@/components/ui/Pulsante';
import { Caricamento, ElencoVuoto, ErroreConAzione } from '@/components/ui/Stati';
import { useToast } from '@/components/ui/Toast';
import { ora } from '@/features/scopri/formato';
import { useOnline } from '@/lib/connessione';
import { messaggi } from '@/lib/messaggi/it';
import { registraErrore } from '@/lib/registro';
import { terminaCheckin, togliDestinatario, type MioCheckin, type Persona } from './api';
import { CHIAVI, useAvvisiVivi, useMioCheckin } from './dati';

const testi = messaggi.vivi.chiLoVede;

/**
 * Chi vede il mio check-in (design/F-20-checkin §3): "Togli" con una conferma leggera nella
 * riga; togliere l'ultima persona termina il check-in, e lo si dice prima.
 */
export function ChiLoVede() {
  useAvvisiVivi();
  const mio = useMioCheckin();

  if (mio.isPending) return <Caricamento descrizione={messaggi.vivi.caricamento} righe={3} />;
  if (mio.isError) {
    return (
      <ErroreConAzione
        titolo={messaggi.vivi.errore.titolo}
        onRiprova={() => void mio.refetch()}
        riprovaInCorso={mio.isFetching}
      >
        {messaggi.vivi.errore.testo}
      </ErroreConAzione>
    );
  }
  if (!mio.data) {
    return (
      <ElencoVuoto
        icona={MapPin}
        titolo={testi.nessuno.titolo}
        azione={
          <Link className="btn btn-secondario" href="/vivi/">
            {testi.nessuno.azione}
          </Link>
        }
      >
        {testi.nessuno.testo}
      </ElencoVuoto>
    );
  }
  return <Destinatari checkin={mio.data} />;
}

function Destinatari({ checkin }: { checkin: MioCheckin }) {
  const [inConferma, setInConferma] = useState<string | null>(null);
  const n = checkin.destinatari.length;
  return (
    <div className="flex flex-col">
      <p className="ck-mono t-didascalia c-2 uppercase m-0">
        {testi.luogo(checkin.locale.nome, ora(checkin.scadeIl))}
      </p>
      <div className="dsp-intestazione">
        <h2 className="etichetta">{testi.destinatari}</h2>
        <span className="ck-mono t-didascalia c-2">{testi.conteggio(n)}</span>
      </div>
      <ul className="m-0 list-none p-0" aria-live="polite">
        {checkin.destinatari.map((persona) => (
          <RigaDestinatario
            key={persona.id}
            checkin={checkin}
            persona={persona}
            ultima={n === 1}
            inConferma={inConferma === persona.id}
            onConferma={(attiva) => setInConferma(attiva ? persona.id : null)}
          />
        ))}
      </ul>
      <p className="ck-nota-fine">
        <Icona icona={Info} dimensione="s" />
        {testi.nota}
      </p>
    </div>
  );
}

function RigaDestinatario({
  checkin,
  persona,
  ultima,
  inConferma,
  onConferma,
}: {
  checkin: MioCheckin;
  persona: Persona;
  ultima: boolean;
  inConferma: boolean;
  onConferma: (attiva: boolean) => void;
}) {
  const client = useQueryClient();
  const mostraToast = useToast();
  const online = useOnline();
  const togli = useMutation({
    // L'ultima persona: si termina il check-in, che il database chiuderebbe comunque.
    mutationFn: () =>
      ultima ? terminaCheckin(checkin.id) : togliDestinatario(checkin.id, persona.id),
    onSuccess: () =>
      mostraToast({ testo: ultima ? testi.terminato : testi.tolta(persona.nome_visualizzato) }),
    onError: (errore) => {
      registraErrore('destinatario del check-in', errore);
      mostraToast({ testo: testi.errore });
    },
    onSettled: () => {
      onConferma(false);
      void client.invalidateQueries({ queryKey: CHIAVI.vivi });
    },
  });

  if (inConferma) {
    return (
      <li className="ck-dest is-conferma">
        <Avatar nome={persona.nome_visualizzato} foto={persona.avatar_path} decorativo />
        <span className="ck-dest-conferma">
          <b>{testi.conferma(persona.nome_visualizzato)}</b>
          {ultima ? testi.ultima : testi.confermaTesto}
        </span>
        <span className="az">
          <Pulsante variante="secondario" dimensione="s" onClick={() => onConferma(false)}>
            {testi.annulla}
          </Pulsante>
          <Pulsante
            variante="secondario"
            dimensione="s"
            disabled={!online}
            caricamento={togli.isPending}
            onClick={() => togli.mutate()}
          >
            {ultima ? testi.togliETermina : testi.togli}
          </Pulsante>
        </span>
      </li>
    );
  }
  return (
    <li className="ck-dest">
      <Avatar nome={persona.nome_visualizzato} foto={persona.avatar_path} decorativo />
      <span className="min-w-0">
        <span className="ck-nome">{persona.nome_visualizzato}</span>
        <span className="ck-username">@{persona.username}</span>
      </span>
      <Pulsante
        variante="secondario"
        dimensione="s"
        disabled={!online}
        aria-label={testi.togliPersona(persona.nome_visualizzato)}
        onClick={() => onConferma(true)}
      >
        {testi.togli}
      </Pulsante>
    </li>
  );
}
