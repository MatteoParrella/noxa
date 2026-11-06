'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, Info, WifiOff } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { GruppoAvatar } from '@/components/ui/Avatar';
import { Avviso } from '@/components/ui/Avviso';
import { Foglio } from '@/components/ui/Foglio';
import { Icona } from '@/components/ui/Icona';
import { MappaRitorno } from '@/components/ui/MappaRitorno';
import { Pillole } from '@/components/ui/Pillole';
import { Pulsante } from '@/components/ui/Pulsante';
import { Caricamento, ErroreConAzione } from '@/components/ui/Stati';
import { useToast } from '@/components/ui/Toast';
import { useOnline } from '@/lib/connessione';
import { ErroreRete } from '@/lib/errori';
import { messaggi } from '@/lib/messaggi/it';
import { registraErrore } from '@/lib/registro';
import { prorogaRitorno, type MioRitorno } from './api';
import {
  AvvisiSessione,
  BadgeRitorno,
  NotaPwa,
  StatoPosizione,
  Tratta,
  useConcludi,
  usePosizioneMia,
} from './Componenti';
import { avviatoQui, CHIAVI_RITORNO, useAvvisiRitorno, useRitorni } from './dati';
import { metri, oraDi, posizioneVecchia, quantoFa, useAdesso } from './formato';

const testi = messaggi.ritorno;
const QUATTRO_ORE = 4 * 60 * 60_000;

/**
 * Dettaglio del proprio ritorno attivo (design/F-21-ritorno-sicuro §4): la mappa con la propria
 * posizione e il cerchio di precisione, senza scia; orari scritti; "Sono arrivato", proroga,
 * chi lo vede e annullamento con una conferma leggera.
 */
export function DettaglioRitorno() {
  const ritorni = useRitorni();
  const online = useOnline();
  const parametri = useSearchParams();
  const router = useRouter();
  const mio = ritorni.data?.mio ?? null;
  useAvvisiRitorno(mio?.id ?? null);
  const proroga = parametri.get('proroga') === '1';
  const annulla = parametri.get('annulla') === '1';
  const chiudi = () => router.replace('/vivi/ritorno/');

  if (ritorni.isPending) return <Caricamento descrizione={testi.amico.caricamento} righe={4} />;
  if (ritorni.isError) {
    return (
      <ErroreConAzione
        titolo={testi.amico.errore}
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
        <p className="t-corpo c-2 m-0">{testi.dettaglio.nessunRitorno}</p>
        <Link className="btn btn-secondario" href="/vivi/">
          {testi.dettaglio.torna}
        </Link>
      </div>
    );
  }
  return (
    <>
      <Contenuto mio={mio} online={online} annulla={annulla} onChiudiAnnulla={chiudi} />
      <Foglio aperto={proroga} onChiudi={chiudi} titolo={testi.proroga.titolo}>
        {proroga && <FoglioProroga mio={mio} onChiudi={chiudi} />}
      </Foglio>
    </>
  );
}

function Contenuto({
  mio,
  online,
  annulla,
  onChiudiAnnulla,
}: {
  mio: MioRitorno;
  online: boolean;
  annulla: boolean;
  onChiudiAnnulla: () => void;
}) {
  const adesso = useAdesso();
  const router = useRouter();
  const concludi = useConcludi(mio);
  const torna = { onSuccess: () => router.push('/vivi/') };
  const posizione = usePosizioneMia(mio);
  const qui = avviatoQui(mio);
  const vecchia = posizione?.inviataIl ? posizioneVecchia(posizione.inviataIl, adesso) : true;
  const inRitardo = new Date(mio.arrivoPrevisto).getTime() < adesso;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <span className="etichetta">{testi.mio.etichetta}</span>
        <BadgeRitorno stato={inRitardo ? 'mio_ritardo' : 'mio_viaggio'} />
      </div>
      <Tratta mio={mio} livello={2} />
      <AvvisiSessione mio={mio} online={online} />
      {posizione && (
        <MappaRitorno
          lat={posizione.lat}
          lon={posizione.lon}
          raggio={posizione.precisione}
          vecchia={vecchia}
          etichetta={testi.dettaglio.mappa}
        >
          <p className="rt-mappa-etichetta m-0">
            <b>
              {posizione.inviataIl && !vecchia
                ? testi.dettaglio.tu(quantoFa(posizione.inviataIl, adesso))
                : posizione.inviataIl
                  ? testi.dettaglio.delle(oraDi(posizione.inviataIl))
                  : testi.mio.posizione.inAttesa}
            </b>
            <span>{testi.dettaglio.circa(metri(posizione.precisione))}</span>
          </p>
        </MappaRitorno>
      )}
      <div aria-live="polite">
        {!online ? (
          <Avviso tipo="info" titolo={testi.dettaglio.offline.titolo}>
            {testi.dettaglio.offline.testo(oraDi(mio.arrivoPrevisto))}
          </Avviso>
        ) : (
          posizione?.inviataIl &&
          vecchia && (
            <Avviso
              tipo="avviso"
              titolo={testi.dettaglio.vecchia.titolo(oraDi(posizione.inviataIl))}
            >
              {testi.dettaglio.vecchia.testo}
            </Avviso>
          )
        )}
      </div>
      {!posizione && <StatoPosizione mio={mio} posizione={posizione} qui={qui} adesso={adesso} />}
      {qui && <NotaPwa />}
      <dl className="rt-dati m-0">
        <div className="rt-dato">
          <dt>
            <span>{testi.dettaglio.arrivoPrevisto}</span>
          </dt>
          <dd className="m-0">
            <b>{oraDi(mio.arrivoPrevisto)}</b>
          </dd>
        </div>
        <div className="rt-dato">
          <dt>
            <span>{testi.dettaglio.partito}</span>
          </dt>
          <dd className="m-0">
            <b>{oraDi(mio.avviatoIl)}</b>
          </dd>
        </div>
        <div className="rt-dato">
          <dt>
            <span>{testi.dettaglio.ultimaPosizione}</span>
          </dt>
          <dd className="m-0">
            <b>
              {posizione?.inviataIl
                ? `${oraDi(posizione.inviataIl)} · ${quantoFa(posizione.inviataIl, adesso)}`
                : testi.dettaglio.nessuna}
            </b>
          </dd>
        </div>
        <div className="rt-dato">
          <dt>
            <span>{testi.dettaglio.precisione}</span>
          </dt>
          <dd className="m-0">
            <b>
              {posizione
                ? testi.dettaglio.circa(metri(posizione.precisione))
                : testi.dettaglio.nessuna}
            </b>
          </dd>
        </div>
      </dl>
      <div className="rt-chi">
        <GruppoAvatar
          persone={mio.destinatari.map((p) => ({ nome: p.nome_visualizzato, foto: p.avatar_path }))}
          decorativo
        />
        <span>{testi.mio.loVedono(mio.destinatari.length)}</span>
      </div>
      <div className="rt-azioni">
        <Pulsante
          variante="principale"
          pieno
          className="principale"
          disabled={!online}
          caricamento={concludi.isPending && concludi.variables === 'arrivato'}
          onClick={() => concludi.mutate('arrivato', torna)}
        >
          {testi.mio.arrivato}
        </Pulsante>
        <Link className="btn btn-secondario btn-pieno" href="/vivi/ritorno/?proroga=1">
          {testi.mio.proroga}
        </Link>
        <Link className="btn btn-secondario btn-pieno" href="/vivi/ritorno/chi-lo-vede/">
          {testi.mio.chiLoVede}
        </Link>
      </div>
      {annulla ? (
        <div className="rt-conferma" role="group" aria-labelledby="rt-annulla-titolo">
          <b id="rt-annulla-titolo">{testi.annulla.titolo}</b>
          <p>{testi.annulla.testo}</p>
          <div className="az">
            <Pulsante variante="secondario" dimensione="s" onClick={onChiudiAnnulla} autoFocus>
              {testi.annulla.no}
            </Pulsante>
            <Pulsante
              variante="secondario"
              dimensione="s"
              disabled={!online}
              caricamento={concludi.isPending && concludi.variables === 'annullato'}
              onClick={() => concludi.mutate('annullato', torna)}
            >
              {testi.annulla.si}
            </Pulsante>
          </div>
        </div>
      ) : (
        <Link className="rt-annulla" href="/vivi/ritorno/?annulla=1">
          {testi.mio.annulla}
        </Link>
      )}
    </div>
  );
}

function FoglioProroga({ mio, onChiudi }: { mio: MioRitorno; onChiudi: () => void }) {
  const client = useQueryClient();
  const mostraToast = useToast();
  const online = useOnline();
  const [minuti, setMinuti] = useState<'15' | '30'>('15');
  const adesso = useAdesso(15_000);
  const limite = new Date(mio.avviatoIl).getTime() + QUATTRO_ORE;
  const base = Math.max(new Date(mio.arrivoPrevisto).getTime(), adesso);
  const nuovo = base + Number(minuti) * 60_000;
  const possibile15 = base + 15 * 60_000 <= limite;
  const possibile30 = base + 30 * 60_000 <= limite;
  const scelta = minuti === '30' && !possibile30 ? '15' : minuti;
  const proroga = useMutation({
    mutationFn: () => prorogaRitorno(mio.id, scelta === '30' ? 30 : 15),
    onSuccess: (arrivo) => {
      mostraToast({ testo: testi.proroga.fatto(oraDi(arrivo)) });
      onChiudi();
    },
    onError: (errore) => {
      if (!(errore instanceof ErroreRete)) registraErrore('proroga del ritorno', errore);
    },
    onSettled: () => void client.invalidateQueries({ queryKey: CHIAVI_RITORNO.tutti }),
  });
  return (
    <div className="flex flex-col gap-4">
      <p className="m-0">{testi.proroga.ora(oraDi(mio.arrivoPrevisto))}</p>
      <div className="rt-scorciatoie">
        <Pillole<'15' | '30'>
          etichetta={testi.proroga.scelta}
          opzioni={[
            { valore: '15', etichetta: testi.proroga.piu15, disattivata: !possibile15 },
            { valore: '30', etichetta: testi.proroga.piu30, disattivata: !possibile30 },
          ]}
          valore={possibile15 ? scelta : null}
          onCambia={setMinuti}
        />
      </div>
      {possibile15 ? (
        <div className="rt-ora" aria-live="polite">
          <span>{testi.proroga.nuovo}</span>
          <b>{oraDi(Math.min(nuovo, limite))}</b>
        </div>
      ) : (
        <p className="ck-motivo">
          <Icona icona={Info} dimensione="s" />
          {testi.proroga.limite(oraDi(limite))}
        </p>
      )}
      {!online && (
        <p className="ck-motivo">
          <Icona icona={WifiOff} dimensione="s" />
          {testi.invito.offline}
        </p>
      )}
      <div aria-live="assertive">
        {proroga.isError && <Avviso tipo="errore">{testi.proroga.errore}</Avviso>}
      </div>
      <div className="rt-due">
        <Pulsante variante="secondario" pieno onClick={onChiudi}>
          {testi.proroga.annulla}
        </Pulsante>
        <Pulsante
          variante="principale"
          pieno
          disabled={!possibile15 || !online}
          caricamento={proroga.isPending}
          onClick={() => proroga.mutate()}
        >
          <Icona icona={Clock} dimensione="s" />
          {testi.proroga.conferma}
        </Pulsante>
      </div>
    </div>
  );
}
