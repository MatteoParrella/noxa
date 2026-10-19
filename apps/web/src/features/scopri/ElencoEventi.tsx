'use client';

import type { UseQueryResult } from '@tanstack/react-query';
import { CircleAlert, CloudOff, SlidersHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';
import { AmiciPartecipano } from '@/components/ui/AmiciPartecipano';
import { Icona } from '@/components/ui/Icona';
import { Rivela } from '@/components/ui/Movimento';
import { Pulsante } from '@/components/ui/Pulsante';
import { RigaEvento, SchedaEvidenza } from '@/components/ui/SchedaEvento';
import { StrisciaOffline } from '@/components/ui/Stati';
import type { DataCalendario } from '@/lib/date';
import { messaggi } from '@/lib/messaggi/it';
import type { EventoElenco } from './api';
import { useCopertine, useNomiGeneri } from './dati';
import { perSerata, testoAmici } from './formato';
import { datiScheda } from './schede';

const testi = messaggi.scopri;

type Props = {
  eventi: UseQueryResult<EventoElenco[]>;
  online: boolean;
  oggi: DataCalendario | null;
  conFiltri: boolean;
  onTogliFiltri: () => void;
};

/** Amici che partecipano a un evento della lista (F-04, R-67). */
export function RigaAmici({ evento }: { evento: EventoElenco }) {
  const testo = testoAmici(evento.amici, evento.amici_partecipano, evento.amici_interessati);
  if (!testo) return null;
  const vanno = evento.amici_partecipano > 0;
  const mostrati = evento.amici
    .filter((amico) => amico.stato === (vanno ? 'partecipo' : 'interessato'))
    .slice(0, 2);
  const totale = vanno ? evento.amici_partecipano : evento.amici_interessati;
  return (
    <AmiciPartecipano
      persone={mostrati.map((amico) => ({ nome: amico.nome_visualizzato }))}
      altri={totale - mostrati.length}
      testo={testo}
    />
  );
}

/**
 * Elenco di Scopri (design/F-01-scopri, tavola 01): la prima serata si apre con la scheda in
 * evidenza, poi righe compatte; le sezioni dividono le serate di un intervallo.
 */
export function ElencoEventi({ eventi, online, oggi, conFiltri, onTogliFiltri }: Props) {
  const elenco = eventi.data ?? [];
  const copertine = useCopertine(
    elenco.map((evento) => ({ tipo: evento.copertina_tipo, path: evento.copertina_path })),
  );
  const nomiGeneri = useNomiGeneri();

  if (!eventi.data) {
    if (!online || eventi.fetchStatus === 'paused') {
      return (
        <div className="pagina">
          <StatoElenco icona={CloudOff} titolo={testi.offlineVuoto.titolo}>
            {testi.offlineVuoto.testo}
          </StatoElenco>
        </div>
      );
    }
    if (eventi.isError) {
      return (
        <div className="pagina" role="alert">
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
    }
    return <ScheletroElenco />;
  }

  if (elenco.length === 0) {
    return (
      <div className="pagina">
        {!online && <StrisciaOffline testo={testi.offline} />}
        <StatoElenco
          icona={SlidersHorizontal}
          titolo={conFiltri ? testi.vuoto.titolo : testi.vuoto.titoloSenzaFiltri}
          azione={
            conFiltri ? (
              <Pulsante variante="secondario" dimensione="s" onClick={onTogliFiltri}>
                {testi.vuoto.azione}
              </Pulsante>
            ) : undefined
          }
        >
          {conFiltri ? testi.vuoto.testo : testi.vuoto.testoSenzaFiltri}
        </StatoElenco>
      </div>
    );
  }

  const serate = perSerata(elenco, oggi ?? undefined);
  let indice = 0;
  return (
    <div className="pagina pb-6" aria-busy={eventi.isFetching}>
      {!online && <StrisciaOffline testo={testi.offline} />}
      {serate.map((serata, posizione) => (
        <section key={serata.data} aria-labelledby={`serata-${serata.data}`}>
          <div className="etichetta-riga scopri-sezione">
            <h2 id={`serata-${serata.data}`} className="etichetta m-0">
              {serata.etichetta}
            </h2>
          </div>
          <ul className="m-0 list-none p-0">
            {serata.eventi.map((evento, numero) => {
              const dati = {
                ...datiScheda(evento, copertine.data, nomiGeneri),
                amici: <RigaAmici evento={evento} />,
              };
              const inEvidenza = posizione === 0 && numero === 0;
              return (
                <Rivela as="li" key={evento.id} indice={Math.min(indice++, 6)}>
                  {inEvidenza ? <SchedaEvidenza dati={dati} /> : <RigaEvento dati={dati} />}
                </Rivela>
              );
            })}
          </ul>
        </section>
      ))}
      <p className="t-didascalia m-0 py-5 text-center">{testi.soloVisibili}</p>
    </div>
  );
}

function StatoElenco({
  icona,
  titolo,
  children,
  azione,
}: {
  icona: typeof CloudOff;
  titolo: string;
  children: string;
  azione?: ReactNode;
}) {
  return (
    <div className="stato-elenco">
      <span className="cornice-icona">
        <Icona icona={icona} />
      </span>
      <h2 className="t-titolo-3 m-0">{titolo}</h2>
      <p className="t-corpo-s c-2 m-0">{children}</p>
      {azione}
    </div>
  );
}

function ScheletroElenco() {
  return (
    <div className="pagina flex flex-col gap-4 pt-4" role="status" aria-live="polite">
      <span className="sr-only">{testi.caricamento}</span>
      <span className="scheletro h-3 w-28" aria-hidden="true" />
      <span className="scheletro scheletro-evidenza" aria-hidden="true" />
      {[0, 1, 2].map((riga) => (
        <span key={riga} className="riga-scheletro" aria-hidden="true">
          <span className="scheletro scheletro-miniatura" />
          <span className="flex flex-col gap-2 pt-1">
            <span className="scheletro h-4 w-3/4" />
            <span className="scheletro h-3 w-1/2" />
            <span className="scheletro h-3 w-1/3" />
          </span>
        </span>
      ))}
    </div>
  );
}
