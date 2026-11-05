'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Clock, MapPin, User, WifiOff } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Avatar, GruppoAvatar } from '@/components/ui/Avatar';
import { Icona } from '@/components/ui/Icona';
import { Entra } from '@/components/ui/Movimento';
import { Pulsante } from '@/components/ui/Pulsante';
import { Caricamento, ErroreConAzione, StrisciaOffline } from '@/components/ui/Stati';
import { useToast } from '@/components/ui/Toast';
import { useIo } from '@/features/amici/dati';
import { ora } from '@/features/scopri/formato';
import { useMontato, useOnline } from '@/lib/connessione';
import { messaggi } from '@/lib/messaggi/it';
import { registraErrore } from '@/lib/registro';
import { terminaCheckin, type CheckinAmico, type MioCheckin } from './api';
import { CHIAVI, useAvvisiVivi, useCheckinAbilitato, useCheckinAmici, useMioCheckin } from './dati';
import { FoglioCheckin } from './FoglioCheckin';

const testi = messaggi.vivi;

const formatoData = new Intl.DateTimeFormat('it-IT', {
  timeZone: 'Europe/Rome',
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
});

/** "SAB 07.11 · 23:52", aggiornata ogni minuto, solo nel browser. */
export function OraStasera() {
  const montato = useMontato();
  const [adesso, setAdesso] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setAdesso(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  if (!montato) return null;
  const data = formatoData.format(adesso).replace(',', '').replace('/', '.');
  return (
    <time className="ck-mono t-didascalia c-2 uppercase" dateTime={adesso.toISOString()}>
      {`${data} · ${ora(adesso.toISOString())}`}
    </time>
  );
}

/**
 * Area Vivi (design/F-20-checkin §1): check-in spento con la spiegazione, oppure il proprio
 * check-in (da fare o attivo), poi gli amici in giro stasera e lo spazio del ritorno sicuro.
 */
export function AreaVivi() {
  const io = useIo();
  const online = useOnline();
  useAvvisiVivi();
  const abilitato = useCheckinAbilitato();
  const mio = useMioCheckin();
  const amici = useCheckinAmici();
  const [foglio, setFoglio] = useState(false);

  if (!io || abilitato.isPending || mio.isPending || amici.isPending) {
    return <Caricamento descrizione={testi.caricamento} righe={4} />;
  }
  if (abilitato.isError || mio.isError || amici.isError) {
    return (
      <ErroreConAzione
        titolo={testi.errore.titolo}
        onRiprova={() => {
          void abilitato.refetch();
          void mio.refetch();
          void amici.refetch();
        }}
        riprovaInCorso={abilitato.isFetching || mio.isFetching || amici.isFetching}
      >
        {testi.errore.testo}
      </ErroreConAzione>
    );
  }

  return (
    <div className="flex flex-col">
      {!online && <StrisciaOffline testo={testi.offline} />}
      {!abilitato.data ? (
        <Entra indice={1}>
          <CheckinSpento />
        </Entra>
      ) : (
        <Entra indice={1}>
          <section className="ck-sezione" aria-labelledby="ck-mio">
            <div className="ck-sezione-testa">
              <h2 className="etichetta" id="ck-mio">
                {testi.mio.etichetta}
              </h2>
            </div>
            {mio.data ? (
              <SchedaMioCheckin checkin={mio.data} online={online} />
            ) : (
              <div className="ck-vuoto">
                <p>{testi.mio.invito}</p>
                <Pulsante
                  variante="principale"
                  pieno
                  disabled={!online}
                  aria-describedby={online ? undefined : 'ck-motivo-offline'}
                  onClick={() => setFoglio(true)}
                >
                  <Icona icona={MapPin} />
                  {testi.mio.fai}
                </Pulsante>
                {!online && (
                  <p className="ck-motivo" id="ck-motivo-offline">
                    <Icona icona={WifiOff} dimensione="s" />
                    {testi.mio.offline}
                  </p>
                )}
              </div>
            )}
          </section>
        </Entra>
      )}
      <Entra indice={2}>
        <AmiciInGiro elenco={amici.data} aggiornatoIl={amici.dataUpdatedAt} online={online} />
      </Entra>
      <div className="ck-riservato" aria-hidden="true" />
      <FoglioCheckin aperto={foglio} onChiudi={() => setFoglio(false)} />
    </div>
  );
}

function CheckinSpento() {
  const icone = [MapPin, User, Clock] as const;
  return (
    <section className="ck-spento mt-4" aria-labelledby="ck-spento-titolo">
      <span className="etichetta">{testi.spento.etichetta}</span>
      <h2 id="ck-spento-titolo">{testi.spento.titolo}</h2>
      <p>{testi.spento.testo}</p>
      <ul className="ck-tre">
        {testi.spento.punti.map((punto, indice) => (
          <li key={punto.titolo}>
            <Icona icona={icone[indice] ?? MapPin} dimensione="s" />
            <span>
              <b>{punto.titolo}</b>
              {punto.testo}
            </span>
          </li>
        ))}
      </ul>
      <Link className="btn btn-principale btn-pieno" href="/profilo/privacy/#pv-chi-vede">
        {testi.spento.attiva}
      </Link>
      <p>{testi.spento.nota}</p>
    </section>
  );
}

/** Il proprio check-in attivo: un timbro sul biglietto, con gli orari scritti (R-30). */
function SchedaMioCheckin({ checkin, online }: { checkin: MioCheckin; online: boolean }) {
  const client = useQueryClient();
  const mostraToast = useToast();
  const termina = useMutation({
    mutationFn: () => terminaCheckin(checkin.id),
    onSuccess: () => mostraToast({ testo: testi.mio.terminato }),
    onError: (errore) => {
      registraErrore('fine del check-in', errore);
      mostraToast({ testo: testi.mio.nonTerminato });
    },
    onSettled: () => void client.invalidateQueries({ queryKey: CHIAVI.vivi }),
  });
  const n = checkin.destinatari.length;
  return (
    <article className="ck-timbro" aria-labelledby="ck-luogo">
      <div className="ck-timbro-testa">
        <div className="min-w-0">
          <h3 className="ck-luogo" id="ck-luogo">
            {checkin.locale.nome}
          </h3>
          <span className="ck-evento">
            {checkin.evento ? `${checkin.evento.titolo} · ` : ''}
            {checkin.locale.comune}
          </span>
        </div>
        <span className="ck-bollo" aria-hidden="true">
          <span>{testi.mio.bollo[0]}</span>
          <b>{testi.mio.bollo[1]}</b>
        </span>
      </div>
      <p className="ck-orari">
        <span>{testi.mio.dalle(ora(checkin.creatoIl))}</span>
        <span className="fino">{testi.mio.finoAlle(ora(checkin.scadeIl))}</span>
      </p>
      <div className="ck-chi">
        <GruppoAvatar
          persone={checkin.destinatari.map((p) => ({
            nome: p.nome_visualizzato,
            foto: p.avatar_path,
          }))}
          decorativo
        />
        <span>{testi.mio.loVedono(n)}</span>
      </div>
      <div className="ck-azioni">
        <Pulsante
          variante="secondario"
          pieno
          disabled={!online}
          caricamento={termina.isPending}
          onClick={() => termina.mutate()}
        >
          {testi.mio.andatoVia}
        </Pulsante>
        <Link className="btn btn-secondario btn-pieno" href="/vivi/chi-lo-vede/">
          {testi.mio.chiLoVede}
        </Link>
      </div>
    </article>
  );
}

function AmiciInGiro({
  elenco,
  aggiornatoIl,
  online,
}: {
  elenco: CheckinAmico[];
  aggiornatoIl: number;
  online: boolean;
}) {
  return (
    <section className="ck-sezione" aria-labelledby="ck-amici">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="etichetta" id="ck-amici">
          {testi.amici.etichetta}
        </h2>
        {!online && aggiornatoIl > 0 && (
          <span className="ck-mono t-didascalia c-2 uppercase">
            {testi.aggiornato(ora(new Date(aggiornatoIl).toISOString()))}
          </span>
        )}
      </div>
      <div aria-live="polite">
        {elenco.length === 0 ? (
          <p className="t-corpo-s c-2 m-0">{testi.amici.vuoto}</p>
        ) : (
          <ul className="ck-elenco">
            {elenco.map((checkin) => (
              <li key={checkin.id}>
                <RigaCheckinAmico checkin={checkin} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** Riga del check-in di un amico: nome, username, locale e da quando (design/F-20-checkin). */
export function RigaCheckinAmico({ checkin }: { checkin: CheckinAmico }) {
  const contenuto = (
    <>
      <Avatar
        nome={checkin.persona.nome_visualizzato}
        foto={checkin.persona.avatar_path}
        decorativo
      />
      <span className="ck-amico-corpo">
        <span className="riga1">
          {checkin.persona.nome_visualizzato}
          <span className="username">@{checkin.persona.username}</span>
        </span>
        <span className="dove">
          {testi.amici.eA} <b>{checkin.locale.nome}</b>
        </span>
      </span>
      <span className="fine">
        <span className="ck-dalle">{testi.amici.dalle(ora(checkin.creatoIl))}</span>
        {checkin.evento && <Icona icona={ChevronRight} dimensione="s" />}
      </span>
    </>
  );
  // Il locale non ha una pagina: si apre l'evento, se è visibile alla tua età (R-20).
  return checkin.evento ? (
    <Link className="ck-amico" href={`/evento/?id=${checkin.evento.id}`}>
      {contenuto}
    </Link>
  ) : (
    <div className="ck-amico">{contenuto}</div>
  );
}
