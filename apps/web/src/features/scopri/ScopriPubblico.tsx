'use client';

import { useQuery } from '@tanstack/react-query';
import { CircleAlert, CloudOff, Moon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { IntestazioneArea } from '@/components/guscio/IntestazioneArea';
import { Rivela } from '@/components/ui/Movimento';
import { Pulsante } from '@/components/ui/Pulsante';
import { RigaEvento, SchedaEvidenza, type DatiSchedaEvento } from '@/components/ui/SchedaEvento';
import { ricordaPaginaDopoAccesso } from '@/features/account/dopoAccesso';
import { PERCORSI } from '@/features/account/documenti';
import { famigliaDaGeneri, semeCopertina } from '@/lib/copertinaGenerata';
import { fotoDiUnElenco } from '@/lib/fotoSerata';
import { useMontato, useOnline } from '@/lib/connessione';
import { aggiungiGiorni, daIso, dataIso, serataInCorso, type DataCalendario } from '@/lib/date';
import { messaggi } from '@/lib/messaggi/it';
import { cercaEventiPubblici, leggiGeneriPubblici, type EventoPubblico } from './api-pubblico';
import { StatoElenco, ScheletroElenco } from './ElencoEventi';
import { etichettaEta, giornoBreve, ora, orario, perSerata } from './formato';

const testi = messaggi.scopri;
const t = testi.pubblico;

/** Giorni mostrati senza account: una settimana, come un volantino. */
const GIORNI = 7;

/** Pagine che restano aperte senza account: tutto il resto porta all'iscrizione. */
const LIBERE = [PERCORSI.registrazione, PERCORSI.accesso, PERCORSI.termini, PERCORSI.privacy];

/** Scheda di una serata pubblica; ogni scheda apre l'iscrizione (ADR-0036). */
function datiPubblici(
  evento: EventoPubblico,
  nomiGeneri: Record<string, string>,
): DatiSchedaEvento {
  const titolo = evento.titolo ?? t.riservata;
  const eta = etichettaEta(evento.eta_minima, evento.eta_minima_dichiarata);
  const giorno = giornoBreve(daIso(evento.data_serata));
  const annullato = evento.stato === 'annullato';
  return {
    href: `/evento/?id=${evento.id}`,
    nome: testi.evento({
      titolo,
      locale: evento.locale_nome,
      comune: evento.locale_comune,
      quando: `${giorno} ${ora(evento.inizio)}`,
      eta,
      altro: [
        ...(annullato ? [testi.annullato] : []),
        ...(evento.riservato ? [t.riservataNota] : []),
      ],
    }),
    titolo,
    locale: evento.locale_nome,
    comune: evento.locale_comune,
    quando: `${giorno} · ${orario(evento.inizio, evento.fine)}`,
    ora: ora(evento.inizio),
    orario: orario(evento.inizio, evento.fine),
    eta,
    generi: evento.generi_evento
      .slice(0, 2)
      .map((codice) => nomiGeneri[codice] ?? codice.replaceAll('_', ' ')),
    meta: evento.riservato ? [t.riservataNota] : [],
    annullato,
    copertina: {
      tipo: 'tipografica',
      alt: '',
      generata: {
        // Una serata riservata non usa il titolo nemmeno per il motivo della copertina.
        seme: semeCopertina(evento.riservato ? evento.id : titolo, evento.locale_nome),
        famiglia: evento.riservato ? 'accento' : famigliaDaGeneri(evento.generi_evento),
        colori: evento.copertina_colori,
      },
    },
  };
}

/**
 * Scopri senza account, solo sul sito (D-18, ADR-0036): l'elenco delle serate della settimana,
 * in forma ridotta. Qualsiasi clic su una pagina dell'app (una serata, la barra delle schede)
 * porta all'iscrizione e, dopo l'accesso, riapre la pagina scelta.
 */
export function ScopriPubblico() {
  const router = useRouter();
  const online = useOnline();
  const montato = useMontato();
  const oggi = useMemo<DataCalendario | null>(() => (montato ? serataInCorso() : null), [montato]);

  const eventi = useQuery({
    queryKey: ['eventi-pubblici', oggi ? dataIso(oggi) : ''],
    queryFn: () => cercaEventiPubblici(dataIso(oggi!), dataIso(aggiungiGiorni(oggi!, GIORNI - 1))),
    enabled: oggi !== null,
    staleTime: 5 * 60_000,
  });
  const generi = useQuery({
    queryKey: ['generi-pubblici'],
    queryFn: leggiGeneriPubblici,
    staleTime: Infinity,
  });

  // Un clic su un link interno dell'app (anche nella barra delle schede) porta all'iscrizione.
  useEffect(() => {
    const suClic = (evento: MouseEvent) => {
      if (evento.defaultPrevented || evento.button !== 0) return;
      const link = (evento.target as Element | null)?.closest?.('a[href]');
      if (!(link instanceof HTMLAnchorElement) || link.origin !== window.location.origin) return;
      const percorso = link.pathname.endsWith('/') ? link.pathname : `${link.pathname}/`;
      if (LIBERE.some((libera) => percorso.startsWith(libera))) return;
      evento.preventDefault();
      if (percorso !== PERCORSI.home) ricordaPaginaDopoAccesso(percorso + link.search);
      router.push(PERCORSI.registrazione);
    };
    document.addEventListener('click', suClic, true);
    return () => document.removeEventListener('click', suClic, true);
  }, [router]);

  const nomiGeneri = generi.data ?? {};
  const elenco = eventi.data ?? [];
  // Nessuna foto d'atmosfera ripetuta nell'elenco (ADR-0032).
  useMemo(
    () =>
      fotoDiUnElenco(
        (eventi.data ?? []).map((evento) => ({
          seme: semeCopertina(
            evento.riservato ? evento.id : (evento.titolo ?? ''),
            evento.locale_nome,
          ),
          famiglia: evento.riservato ? 'accento' : famigliaDaGeneri(evento.generi_evento),
        })),
      ),
    [eventi.data],
  );

  let contenuto;
  if (!eventi.data) {
    if (!online || eventi.fetchStatus === 'paused') {
      contenuto = (
        <StatoElenco icona={CloudOff} titolo={testi.offlineVuoto.titolo}>
          {testi.offlineVuoto.testo}
        </StatoElenco>
      );
    } else if (eventi.isError) {
      contenuto = (
        <div role="alert">
          <StatoElenco
            icona={CircleAlert}
            titolo={testi.errore.titolo}
            azione={
              <Pulsante
                variante="secondario"
                dimensione="s"
                caricamento={eventi.isFetching}
                onClick={() => void eventi.refetch()}
              >
                {messaggi.comune.riprova}
              </Pulsante>
            }
          >
            {testi.errore.testo}
          </StatoElenco>
        </div>
      );
    } else {
      contenuto = <ScheletroElenco />;
    }
  } else if (elenco.length === 0) {
    contenuto = (
      <StatoElenco icona={Moon} titolo={t.vuoto.titolo}>
        {t.vuoto.testo}
      </StatoElenco>
    );
  } else {
    let indice = 0;
    // In evidenza va la prima serata con il titolo: una serata riservata resta una riga.
    const serate = perSerata(elenco, oggi ?? undefined);
    const primaSerata = serate[0];
    const inEvidenzaId = primaSerata?.eventi.find((evento) => !evento.riservato)?.id;
    contenuto = serate.map((serata) => (
      <section key={serata.data} aria-labelledby={`serata-${serata.data}`}>
        <div className="etichetta-riga scopri-sezione">
          <h2 id={`serata-${serata.data}`} className="etichetta m-0">
            {serata.etichetta}
          </h2>
        </div>
        <ul className="elenco-serata m-0 list-none p-0">
          {serata.eventi.map((evento) => {
            const dati = datiPubblici(evento, nomiGeneri);
            const inEvidenza = evento.id === inEvidenzaId && serata === primaSerata;
            return (
              <Rivela
                as="li"
                key={evento.id}
                indice={Math.min(indice++, 6)}
                className={inEvidenza ? 'in-evidenza' : ''}
              >
                {inEvidenza ? <SchedaEvidenza dati={dati} /> : <RigaEvento dati={dati} />}
              </Rivela>
            );
          })}
        </ul>
      </section>
    ));
  }

  return (
    <div className="flex flex-col">
      <IntestazioneArea
        titolo={testi.titolo}
        dopoTitolo={<span className="t-mono-dato c-2">{t.prossimiGiorni}</span>}
        azioni={
          <Link className="btn btn-s btn-secondario" href={PERCORSI.accesso}>
            {t.entra}
          </Link>
        }
      />
      <Rivela className="pagina w-full" indice={2}>
        <div className="scopri-invito">
          <p className="t-corpo-s m-0">{t.invito}</p>
          <Link className="btn btn-s btn-principale flex-none" href={PERCORSI.registrazione}>
            {t.creaAccount}
          </Link>
        </div>
      </Rivela>
      <div className="scopri-contenuto">
        <div className="pagina pb-6" aria-busy={eventi.isFetching}>
          {contenuto}
          <p className="t-didascalia m-0 py-5 text-center">{t.soloIscritti}</p>
        </div>
      </div>
    </div>
  );
}
