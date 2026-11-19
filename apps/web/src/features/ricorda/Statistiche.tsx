'use client';

import { ChartColumn, ChevronDown, ChevronUp, List, Plus } from 'lucide-react';
import Link from 'next/link';
import { useId, useState } from 'react';
import { Icona } from '@/components/ui/Icona';
import { Pillole } from '@/components/ui/Pillole';
import { Caricamento, ElencoVuoto, ErroreConAzione, StrisciaOffline } from '@/components/ui/Stati';
import { useMontato, useOnline } from '@/lib/connessione';
import { messaggi } from '@/lib/messaggi/it';
import type { Conteggio, Statistiche as DatiStatistiche } from './api-anno';
import { useDiario } from './dati';
import { useStatistiche } from './dati-anno';
import { euro } from './formato';

const testi = messaggi.ricorda.statistiche;

type Periodo = 'quest' | 'scorso' | 'sempre';

/** Anno solare di oggi a Roma: il periodo «Quest'anno». */
export function annoDiRoma(adesso = new Date()): number {
  return Number(
    new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', year: 'numeric' }).format(adesso),
  );
}

const quando = (ms: number) =>
  new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(new Date(ms))
    .replace(',', ' ·');

/** Ricorda › Statistiche (design/F-31-statistiche §1): numeri neutri dal tuo diario. */
export function Statistiche() {
  const montato = useMontato();
  const [periodo, setPeriodo] = useState<Periodo>('quest');
  const anno = montato ? annoDiRoma() : null;
  const annoScelto =
    periodo === 'sempre' || anno === null ? null : periodo === 'quest' ? anno : anno - 1;
  const query = useStatistiche(annoScelto, montato);
  const online = useOnline();
  const diario = useDiario();
  const diarioVuoto = diario.stato === 'pronto' && diario.voci.length === 0;

  return (
    <div className="flex flex-col gap-2">
      <Pillole
        etichetta={testi.periodo}
        opzioni={[
          { valore: 'quest', etichetta: testi.quest },
          { valore: 'scorso', etichetta: testi.scorso },
          { valore: 'sempre', etichetta: testi.sempre },
        ]}
        valore={periodo}
        onCambia={setPeriodo}
      />
      {!online && query.data && (
        <>
          <StrisciaOffline testo={testi.offline} />
          <p className="ri-st-aggiornate">{testi.aggiornate(quando(query.dataUpdatedAt))}</p>
        </>
      )}
      <Contenuto query={query} diarioVuoto={diarioVuoto} />
    </div>
  );
}

function Contenuto({
  query,
  diarioVuoto,
}: {
  query: ReturnType<typeof useStatistiche>;
  diarioVuoto: boolean;
}) {
  if (diarioVuoto) {
    return (
      <div className="pt-4">
        <ElencoVuoto
          icona={ChartColumn}
          titolo={testi.vuoto.titolo}
          azione={
            <Link className="btn btn-principale" href="/ricorda/modifica/">
              <Icona icona={Plus} dimensione="s" />
              {messaggi.ricorda.area.aggiungi}
            </Link>
          }
        >
          {testi.vuoto.testo}
        </ElencoVuoto>
      </div>
    );
  }
  // Un periodo senza serate resta una pagina di statistiche: mesi a zero, sezioni vuote.
  if (query.data) return <Sezioni dati={query.data} />;
  if (query.isError) {
    return (
      <div className="pt-4">
        <ErroreConAzione
          titolo={testi.errore.titolo}
          onRiprova={() => void query.refetch()}
          riprovaInCorso={query.isFetching}
        >
          {testi.errore.testo}
        </ErroreConAzione>
      </div>
    );
  }
  return (
    <div className="pt-4">
      <Caricamento descrizione={testi.caricamento} righe={4} />
    </div>
  );
}

function Sezioni({ dati }: { dati: DatiStatistiche }) {
  const perAnno = dati.per_anno;
  return (
    <div className="ri-st-griglia">
      <Sezione
        titolo={perAnno ? testi.perAnno : testi.perMese}
        nota={testi.serate(dati.serate)}
        largo
      >
        {perAnno ? (
          <Grafico
            valori={perAnno.map((x) => x.serate)}
            etichette={perAnno.map((x) => String(x.anno))}
            nomi={perAnno.map((x) => String(x.anno))}
          />
        ) : (
          <Grafico valori={dati.per_mese ?? []} etichette={testi.iniziali} nomi={testi.mesi} />
        )}
      </Sezione>
      <Sezione titolo={testi.locali} nota={testi.unita}>
        <Classifica righe={dati.locali} />
      </Sezione>
      <Sezione titolo={testi.generi} nota={testi.unita}>
        <Classifica righe={dati.generi} />
      </Sezione>
      <Sezione titolo={testi.dj} nota={testi.unita}>
        <Classifica righe={dati.dj} />
      </Sezione>
      <Spese dati={dati.spese} />
    </div>
  );
}

function Sezione({
  titolo,
  nota,
  largo = false,
  children,
}: {
  titolo: string;
  nota?: string;
  largo?: boolean;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <section className={largo ? 'ri-st-sez ri-st-larga' : 'ri-st-sez'} aria-labelledby={id}>
      <div className="ri-st-testa">
        <h2 id={id}>{titolo}</h2>
        {nota && <span>{nota}</span>}
      </div>
      {children}
    </section>
  );
}

/**
 * Barre sottili con il numero sopra; l'alternativa testuale è nell'etichetta del grafico e in
 * un elenco che si apre (design/F-31-statistiche §Accessibilità).
 */
export function Grafico({
  valori,
  etichette,
  nomi,
}: {
  valori: readonly number[];
  etichette: readonly string[];
  nomi: readonly string[];
}) {
  const [elenco, setElenco] = useState(false);
  const idElenco = useId();
  const massimo = Math.max(1, ...valori);
  const descrizione = valori.map((v, i) => `${nomi[i] ?? ''}: ${testi.serate(v)}`).join(', ');
  return (
    <div>
      <div
        className="ri-barre"
        style={{ gridTemplateColumns: `repeat(${valori.length}, minmax(0, 1fr))` }}
        role="img"
        aria-label={testi.grafico(descrizione)}
      >
        {valori.map((v, i) => (
          <div key={`${nomi[i]}-${i}`} className={v === 0 ? 'ri-barra is-zero' : 'ri-barra'}>
            <b>{v}</b>
            <i style={{ height: `${Math.round((v / massimo) * 96)}px` }} />
          </div>
        ))}
      </div>
      <div
        className="ri-barre-etichette"
        style={{ gridTemplateColumns: `repeat(${valori.length}, minmax(0, 1fr))` }}
        aria-hidden="true"
      >
        {etichette.map((e, i) => (
          <span key={`${e}-${i}`}>{e}</span>
        ))}
      </div>
      <button
        type="button"
        className="ri-alt"
        aria-expanded={elenco}
        aria-controls={idElenco}
        onClick={() => setElenco((v) => !v)}
      >
        <Icona icona={elenco ? ChartColumn : List} dimensione="s" />
        {elenco ? testi.nascondiElenco : testi.vediElenco}
      </button>
      <ul id={idElenco} className="ri-elenco-mesi" hidden={!elenco}>
        {valori.map((v, i) => (
          <li key={`${nomi[i]}-${i}`}>
            {nomi[i]}
            <span>{v}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Classifica numerata: per numero di serate, poi in ordine alfabetico. Nessuna freccia. */
export function Classifica({ righe }: { righe: readonly Conteggio[] }) {
  if (righe.length === 0) return <p className="ri-niente">{testi.niente}</p>;
  return (
    <ol className="ri-classifica">
      {righe.map((riga, i) => (
        <li key={riga.nome}>
          <span className="ri-pos" aria-hidden="true">
            {String(i + 1).padStart(2, '0')}
          </span>
          <span>{riga.nome}</span>
          <span className="ri-num">
            {riga.serate}
            <span className="sr-only"> {testi.unita}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Spese chiuse di default, in testo normale: la spesa non è un traguardo (R-43). */
function Spese({ dati }: { dati: DatiStatistiche['spese'] }) {
  const [aperta, setAperta] = useState(false);
  const id = useId();
  return (
    <section className="ri-st-sez ri-st-larga">
      <h2 className="m-0">
        <button
          type="button"
          className="ri-richiudi"
          aria-expanded={aperta}
          aria-controls={id}
          onClick={() => setAperta((v) => !v)}
        >
          <span className="ri-richiudi-titolo">{testi.spese}</span>
          <span className="ri-richiudi-azione">
            {aperta ? testi.nascondi : testi.mostra}
            <Icona icona={aperta ? ChevronUp : ChevronDown} dimensione="s" />
          </span>
        </button>
      </h2>
      <div id={id} hidden={!aperta}>
        {dati.per_categoria.length === 0 ? (
          <p className="ri-niente">{testi.speseVuote}</p>
        ) : (
          <ul className="ri-st-spese">
            <li className="is-totale">
              {testi.totale}
              <span>{euro(dati.totale_centesimi)}</span>
            </li>
            {dati.per_categoria.map((riga) => (
              <li key={riga.categoria}>
                {messaggi.ricorda.categorie[riga.categoria]}
                <span>{euro(riga.importo_centesimi)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="ri-st-nota">{testi.speseNota}</p>
      </div>
    </section>
  );
}
