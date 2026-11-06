'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Check, ChevronRight, Clock, TriangleAlert, X } from 'lucide-react';
import Link from 'next/link';
import { Avatar, GruppoAvatar } from '@/components/ui/Avatar';
import { Avviso } from '@/components/ui/Avviso';
import { Icona } from '@/components/ui/Icona';
import { Pulsante } from '@/components/ui/Pulsante';
import { useToast } from '@/components/ui/Toast';
import { classi } from '@/lib/classi';
import { ErroreRete } from '@/lib/errori';
import { messaggi } from '@/lib/messaggi/it';
import { registraErrore } from '@/lib/registro';
import { concludiRitorno, type MioRitorno, type RitornoAmico } from './api';
import { avviatoQui, CHIAVI_RITORNO, trattaLocale, useAreeArrivo } from './dati';
import { leggiSessioneLocale, salvaSessioneLocale } from './dispositivo';
import {
  oraDi,
  posizioneVecchia,
  quantoFa,
  statoAmico,
  useAdesso,
  type StatoAmico,
} from './formato';
import { aggiornaMotore, ANTICIPO_PROMEMORIA, azzeraMotore, useMotore } from './motore';
import { serveNotaSchermo } from './posizione';

const testi = messaggi.ritorno;

/** "Sono arrivato" e "Annulla ritorno": chiudono anche la sessione su questo telefono. */
export function useConcludi(mio: MioRitorno | null) {
  const client = useQueryClient();
  const mostraToast = useToast();
  return useMutation({
    mutationFn: (stato: 'arrivato' | 'annullato') => concludiRitorno(mio!.id, stato),
    onSuccess: (_, stato) => {
      if (leggiSessioneLocale()?.ritornoId === mio?.id) salvaSessioneLocale(null);
      azzeraMotore();
      mostraToast({ testo: stato === 'arrivato' ? testi.mio.arrivatoFatto : testi.mio.annullato });
    },
    onError: (errore) => {
      if (!(errore instanceof ErroreRete)) registraErrore('fine del ritorno', errore);
      mostraToast({ testo: testi.mio.nonConcluso });
    },
    onSettled: () => void client.invalidateQueries({ queryKey: CHIAVI_RITORNO.tutti }),
  });
}

/** Ultima posizione che vedono gli amici: quella inviata da qui o quella letta dal server. */
export function usePosizioneMia(mio: MioRitorno) {
  const motore = useMotore();
  const qui = avviatoQui(mio) && motore.ritornoId === mio.id;
  if (qui && motore.ultima) {
    return {
      lat: motore.ultima.lat,
      lon: motore.ultima.lon,
      precisione: motore.ultima.precisione,
      inviataIl:
        motore.inviataIl ??
        (mio.posizione ? new Date(mio.posizione.registrata_il).getTime() : null),
    };
  }
  if (!mio.posizione) return null;
  return {
    lat: mio.posizione.lat,
    lon: mio.posizione.lon,
    precisione: mio.posizione.precisione_m,
    inviataIl: new Date(mio.posizione.registrata_il).getTime(),
  };
}

export function BadgeRitorno({ stato }: { stato: StatoAmico | 'mio_ritardo' | 'mio_viaggio' }) {
  const t = testi.amico;
  const voce =
    stato === 'in_ritardo' || stato === 'mio_ritardo'
      ? { classe: 'ritardo', icona: TriangleAlert, testo: t.inRitardo }
      : stato === 'arrivato'
        ? { classe: 'arrivata', icona: Check, testo: t.arrivato }
        : stato === 'terminato'
          ? { classe: 'finito', icona: X, testo: t.terminato }
          : { classe: 'viaggio', icona: ArrowRight, testo: t.inViaggio };
  return (
    <span className={classi('rt-badge', voce.classe)}>
      <Icona icona={voce.icona} dimensione="s" />
      {voce.testo}
    </span>
  );
}

/** Tratta "Binario 7 → Casa" (partenza e arrivo restano su questo telefono, R-32). */
export function Tratta({
  mio,
  livello = 3,
  id,
}: {
  mio: MioRitorno;
  livello?: 1 | 2 | 3;
  id?: string;
}) {
  const aree = useAreeArrivo();
  const { partenza, arrivo } = trattaLocale(mio, aree, testi.tratta.casa);
  const Titolo = `h${livello}` as const;
  return (
    <Titolo className="rt-tratta" id={id}>
      {partenza ? (
        <>
          <span>{partenza}</span>
          <span className="freccia" aria-label="verso">
            {testi.tratta.freccia}
          </span>
          <span>{arrivo}</span>
        </>
      ) : (
        <span>{testi.tratta.verso(arrivo)}</span>
      )}
    </Titolo>
  );
}

/** Il proprio ritorno attivo: un biglietto di corsa notturna (design §1). */
export function BigliettoRitorno({ mio, online }: { mio: MioRitorno; online: boolean }) {
  const adesso = useAdesso();
  const concludi = useConcludi(mio);
  const posizione = usePosizioneMia(mio);
  const qui = avviatoQui(mio);
  const inRitardo = new Date(mio.arrivoPrevisto).getTime() < adesso;
  const n = mio.destinatari.length;
  return (
    <article className="rt-biglietto" aria-labelledby="rt-tratta">
      <div className="flex items-center justify-between gap-3">
        <span className="etichetta">{testi.mio.etichetta}</span>
        <BadgeRitorno stato={inRitardo ? 'mio_ritardo' : 'mio_viaggio'} />
      </div>
      <Tratta mio={mio} id="rt-tratta" />
      <p className="rt-orario">
        <span>{testi.mio.partito(oraDi(mio.avviatoIl))}</span>
        <b>{testi.mio.arrivoPrevisto(oraDi(mio.arrivoPrevisto))}</b>
      </p>
      <StatoPosizione mio={mio} posizione={posizione} qui={qui} adesso={adesso} />
      <div className="rt-taglio" aria-hidden="true" />
      <div className="rt-chi">
        <GruppoAvatar
          persone={mio.destinatari.map((p) => ({ nome: p.nome_visualizzato, foto: p.avatar_path }))}
          decorativo
        />
        <span>{testi.mio.loVedono(n)}</span>
      </div>
      <div className="rt-azioni">
        <Pulsante
          variante="principale"
          pieno
          className="principale"
          disabled={!online}
          caricamento={concludi.isPending && concludi.variables === 'arrivato'}
          onClick={() => concludi.mutate('arrivato')}
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
      <Link className="rt-annulla" href="/vivi/ritorno/?annulla=1">
        {testi.mio.annulla}
      </Link>
    </article>
  );
}

export function StatoPosizione({
  mio,
  posizione,
  qui,
  adesso,
}: {
  mio: MioRitorno;
  posizione: ReturnType<typeof usePosizioneMia>;
  qui: boolean;
  adesso: number;
}) {
  if (!qui && !mio.posizione)
    return <p className="rt-stato-pos is-ferma m-0">{testi.mio.posizione.altroTelefono}</p>;
  if (!posizione?.inviataIl)
    return <p className="rt-stato-pos is-ferma m-0">{testi.mio.posizione.inAttesa}</p>;
  const vecchia = posizioneVecchia(posizione.inviataIl, adesso);
  return (
    <p className={classi('rt-stato-pos m-0', vecchia && 'is-vecchia')}>
      {vecchia
        ? testi.mio.posizione.vecchia(oraDi(posizione.inviataIl))
        : testi.mio.posizione.condivisa(quantoFa(posizione.inviataIl, adesso))}
    </p>
  );
}

/**
 * Avvisi della sessione sul telefono del titolare: arrivo automatico con "Non ero arrivato" per
 * un minuto e promemoria 10 minuti prima dell'arrivo previsto (design §4). Annunciati con
 * cortesia, mai con un conto alla rovescia (R-43).
 */
export function AvvisiSessione({ mio, online }: { mio: MioRitorno; online: boolean }) {
  const adesso = useAdesso(10_000);
  const motore = useMotore();
  const concludi = useConcludi(mio);
  const mostraToast = useToast();
  const arrivo = new Date(mio.arrivoPrevisto).getTime();
  if (motore.arrivoInAttesa && motore.ritornoId === mio.id) {
    return (
      <Avviso
        tipo="successo"
        titolo={testi.arrivoAutomatico.titolo(motore.arrivoInAttesa.area)}
        azioni={
          <span className="rt-avviso-azioni">
            <Pulsante
              variante="secondario"
              dimensione="s"
              onClick={() => {
                aggiornaMotore({ arrivoInAttesa: null, areaIgnorata: true });
                mostraToast({ testo: testi.arrivoAutomatico.ripreso });
              }}
            >
              {testi.arrivoAutomatico.nonEro}
            </Pulsante>
            <span className="rt-mono">
              {testi.arrivoAutomatico.entro(oraDi(motore.arrivoInAttesa.scadenza))}
            </span>
          </span>
        }
      >
        {testi.arrivoAutomatico.testo}
      </Avviso>
    );
  }
  const promemoria =
    adesso >= arrivo - ANTICIPO_PROMEMORIA &&
    adesso < arrivo &&
    motore.promemoriaChiuso !== mio.arrivoPrevisto;
  if (!promemoria) return null;
  return (
    <Avviso
      tipo="info"
      titolo={testi.promemoria.titolo}
      azioni={
        <span className="rt-avviso-azioni">
          <Pulsante
            variante="secondario"
            dimensione="s"
            disabled={!online}
            caricamento={concludi.isPending}
            onClick={() => concludi.mutate('arrivato')}
          >
            {testi.mio.arrivato}
          </Pulsante>
          <Link
            className="btn btn-secondario btn-s"
            href="/vivi/ritorno/?proroga=1"
            onClick={() => aggiornaMotore({ promemoriaChiuso: mio.arrivoPrevisto })}
          >
            {testi.mio.proroga}
          </Link>
        </span>
      }
    >
      {testi.promemoria.testo}
    </Avviso>
  );
}

/** Riga del ritorno di un amico con lo stato (design §1, §5). */
export function RigaRitornoAmico({ ritorno }: { ritorno: RitornoAmico }) {
  const adesso = useAdesso();
  const stato = statoAmico(ritorno, adesso);
  const persona = ritorno.persona;
  return (
    <Link
      className="rt-amico"
      href={`/vivi/ritorno-amico/?id=${ritorno.id}`}
      aria-label={testi.amico.apri(persona.nome_visualizzato)}
    >
      <Avatar nome={persona.nome_visualizzato} foto={persona.avatar_path} decorativo />
      <span className="rt-amico-corpo">
        <span className="riga1">
          <b>{persona.nome_visualizzato}</b>
          <span className="username">@{persona.username}</span>
        </span>
        <BadgeRitorno stato={stato} />
        <span className="ck-mono t-didascalia c-2 uppercase">
          {stato === 'arrivato' && ritorno.conclusoIl
            ? testi.amico.allaRiga(oraDi(ritorno.conclusoIl))
            : testi.amico.arrivoRiga(oraDi(ritorno.arrivoPrevisto))}
        </span>
      </span>
      <span className="fine">
        <Icona icona={ChevronRight} dimensione="s" />
      </span>
    </Link>
  );
}

/**
 * Nota del browser del telefono, ben visibile e non nascosta (ADR-0006): mai nell'app
 * installata, dove la posizione arriva anche a schermo bloccato, e mai da computer.
 */
export function NotaPwa() {
  if (!serveNotaSchermo()) return null;
  return (
    <p className="rt-pwa m-0">
      <Icona icona={Clock} dimensione="s" className="ico" />
      <span>
        <b>{testi.avvia.riepilogo.pwa.titolo}</b> {testi.avvia.riepilogo.pwa.testo}
      </span>
    </p>
  );
}
