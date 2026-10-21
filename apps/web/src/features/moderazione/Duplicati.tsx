'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CircleCheck, Copy, Info } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Avviso } from '@/components/ui/Avviso';
import { Icona } from '@/components/ui/Icona';
import { Pulsante } from '@/components/ui/Pulsante';
import { Caricamento, ElencoVuoto, ErroreConAzione } from '@/components/ui/Stati';
import { messaggi } from '@/lib/messaggi/it';
import { decidiDuplicato, type Duplicato, type EventoConfronto } from './api';
import { CHIAVI, useDuplicati } from './dati';
import { dataOra, etichettaEta, prezzo, serata, testoErrore, urlBreve } from './formato';
import { Testata } from './Testata';

const testi = messaggi.moderazione;
const d = testi.duplicati;

type Campo = keyof typeof d.campi;
const CAMPI: Campo[] = [
  'titolo',
  'locale',
  'inizio',
  'fine',
  'eta',
  'alcol',
  'generi',
  'artisti',
  'prezzo',
  'link',
];

function quando(istante: string | null): string {
  if (!istante) return '—';
  const giorno = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(
    new Date(istante),
  );
  return `${serata(giorno)} ${dataOra(istante).split(' ')[1] ?? ''}`;
}

function valore(evento: EventoConfronto, campo: Campo): string {
  switch (campo) {
    case 'titolo':
      return evento.titolo;
    case 'locale':
      return evento.locale_nome ?? '—';
    case 'inizio':
      return quando(evento.inizio);
    case 'fine':
      return quando(evento.fine);
    case 'eta':
      return evento.eta_minima === null
        ? etichettaEta(18, false)
        : etichettaEta(evento.eta_minima, evento.eta_minima_dichiarata ?? true);
    case 'alcol':
      return evento.riferimenti_alcol ? testi.comune.si : testi.comune.no;
    case 'generi':
      return evento.generi.join(', ') || '—';
    case 'artisti':
      return evento.artisti.join(' · ') || '—';
    case 'prezzo':
      return prezzo(evento.prezzo_min_centesimi);
    case 'link':
      return evento.url ? urlBreve(evento.url) : '—';
  }
}

function anteprimaFusione(esistente: EventoConfronto, raccolto: EventoConfronto): string {
  const eta = Math.max(esistente.eta_minima ?? 18, raccolto.eta_minima ?? 18);
  const dichiarata = (esistente.eta_minima_dichiarata ?? false) || raccolto.eta_minima !== null;
  const generi = [...new Set([...esistente.generi, ...raccolto.generi])].slice(0, 5);
  return d.anteprima(
    etichettaEta(eta, dichiarata),
    esistente.riferimenti_alcol || raccolto.riferimenti_alcol,
    generi.join(', ') || '—',
  );
}

/** Coda dei possibili duplicati con il confronto affiancato (EVENT_INGESTION.md §6.4). */
export function Duplicati() {
  const client = useQueryClient();
  const duplicati = useDuplicati();
  const [scelto, setScelto] = useState<string | null>(null);
  const [salvato, setSalvato] = useState<string | null>(null);
  const elenco = duplicati.data ?? [];
  const indice = Math.max(
    0,
    elenco.findIndex((voce) => voce.id === scelto),
  );
  const corrente = elenco[indice] ?? null;
  const titolo = useRef<HTMLHeadingElement>(null);

  const decisione = useMutation({
    mutationFn: ({ voce, stesso }: { voce: Duplicato; stesso: boolean }) =>
      decidiDuplicato(voce.id, stesso),
    onSuccess: (_, { voce, stesso }) => {
      setSalvato(d.salvato(voce.raccolto.titolo, stesso));
      setScelto(elenco[indice + 1]?.id ?? null);
      void client.invalidateQueries({ queryKey: CHIAVI.duplicati });
      void client.invalidateQueries({ queryKey: CHIAVI.contatori });
      titolo.current?.focus();
    },
  });

  // Scorciatoie: S stesso evento, D eventi distinti, frecce per scorrere la coda.
  const statoTasti = useRef({ corrente, indice, elenco, decisione });
  useEffect(() => {
    statoTasti.current = { corrente, indice, elenco, decisione };
  });
  useEffect(() => {
    function tasto(evento: KeyboardEvent) {
      const bersaglio = evento.target as HTMLElement;
      if (
        bersaglio.closest('input, textarea, select, dialog[open]') ||
        evento.metaKey ||
        evento.ctrlKey
      )
        return;
      const {
        corrente: voce,
        indice: posizione,
        elenco: coda,
        decisione: azione,
      } = statoTasti.current;
      if (!voce || azione.isPending) return;
      const tastoPremuto = evento.key.toLowerCase();
      if (tastoPremuto === 's' && voce.esistente) azione.mutate({ voce, stesso: true });
      else if (tastoPremuto === 'd') azione.mutate({ voce, stesso: false });
      else if (evento.key === 'ArrowDown' || evento.key === 'ArrowRight') {
        setScelto(coda[Math.min(posizione + 1, coda.length - 1)]?.id ?? null);
      } else if (evento.key === 'ArrowUp' || evento.key === 'ArrowLeft') {
        setScelto(coda[Math.max(posizione - 1, 0)]?.id ?? null);
      } else return;
      evento.preventDefault();
    }
    window.addEventListener('keydown', tasto);
    return () => window.removeEventListener('keydown', tasto);
  }, []);

  return (
    <>
      <Testata
        titolo={d.titolo}
        conta={duplicati.data ? String(elenco.length) : undefined}
        strumenti={
          <p className="guida m-0 flex flex-wrap items-center gap-2" aria-hidden="true">
            <span className="tasto">S</span> {d.tasti.stesso} <span className="tasto">D</span>{' '}
            {d.tasti.distinti} <span className="tasto">↑</span>
            <span className="tasto">↓</span> {d.tasti.scorri}
          </p>
        }
      />
      <div className="md-contenuto">
        {elenco.length > 0 && (
          <nav className="md-coda" aria-label={d.coda}>
            <ul>
              {elenco.map((voce) => (
                <li key={voce.id}>
                  <button
                    type="button"
                    className="coda-voce"
                    aria-current={voce.id === corrente?.id ? 'true' : undefined}
                    onClick={() => setScelto(voce.id)}
                  >
                    <span className="punteggio">
                      {voce.punteggio !== null ? Math.round(voce.punteggio) : '—'}
                    </span>
                    <b>{voce.raccolto.titolo}</b>
                    <span>
                      {voce.motivo}
                      <br />
                      {d.arrivato(voce.fonte ?? '—', dataOra(voce.arrivatoIl))}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <div className="md-scorre pt-5">
          {duplicati.isPending && <Caricamento descrizione={d.caricamento} righe={8} />}
          {duplicati.isError && (
            <ErroreConAzione
              titolo={testi.comune.erroreCaricamento.titolo}
              onRiprova={() => void duplicati.refetch()}
              riprovaInCorso={duplicati.isFetching}
            >
              {testi.comune.erroreCaricamento.testo}
            </ErroreConAzione>
          )}
          {salvato && (
            <div className="conferma-riga mb-4" role="status">
              <Icona icona={CircleCheck} dimensione="s" />
              {salvato}
            </div>
          )}
          {decisione.isError && (
            <div className="mb-4">
              <Avviso
                tipo="errore"
                titolo={d.errore.titolo}
                portaInVista
                azioni={
                  <Pulsante
                    variante="secondario"
                    dimensione="s"
                    onClick={() => decisione.mutate(decisione.variables)}
                  >
                    {messaggi.comune.riprova}
                  </Pulsante>
                }
              >
                {d.errore.testo} {testoErrore(decisione.error)}
              </Avviso>
            </div>
          )}
          {duplicati.data && elenco.length === 0 && (
            <ElencoVuoto icona={Copy} titolo={d.vuoto.titolo}>
              {d.vuoto.testo}
            </ElencoVuoto>
          )}
          {corrente && (
            <article aria-labelledby="duplicato-titolo" className="flex flex-col gap-4">
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="punteggio">
                  {corrente.punteggio !== null ? Math.round(corrente.punteggio) : '—'}
                </span>
                <h2 id="duplicato-titolo" ref={titolo} tabIndex={-1} className="t-titolo-2 m-0">
                  {corrente.raccolto.titolo}
                </h2>
                <span className="guida">{corrente.motivo}</span>
              </div>
              <p className="guida t-mono-dato m-0">
                {d.arrivato(corrente.fonte ?? '—', dataOra(corrente.arrivatoIl))} ·{' '}
                {d.posizione(indice + 1, elenco.length)}
              </p>
              {corrente.esistente ? (
                <Confronto esistente={corrente.esistente} raccolto={corrente.raccolto} />
              ) : (
                <Avviso tipo="info">{d.senzaCandidato}</Avviso>
              )}
              {corrente.esistente && (
                <div className="effetto">
                  <Icona icona={Info} dimensione="s" />
                  <span>
                    <b>{d.anteprimaTitolo}</b>,{' '}
                    {anteprimaFusione(corrente.esistente, corrente.raccolto)}
                  </span>
                </div>
              )}
              <div className="cf-azioni">
                {corrente.esistente && (
                  <Pulsante
                    variante="principale"
                    caricamento={decisione.isPending && decisione.variables?.stesso === true}
                    onClick={() => decisione.mutate({ voce: corrente, stesso: true })}
                    aria-keyshortcuts="S"
                  >
                    {d.stesso}{' '}
                    <span className="tasto" aria-hidden="true">
                      S
                    </span>
                  </Pulsante>
                )}
                <Pulsante
                  variante="secondario"
                  caricamento={decisione.isPending && decisione.variables?.stesso === false}
                  onClick={() => decisione.mutate({ voce: corrente, stesso: false })}
                  aria-keyshortcuts="D"
                >
                  {d.distinti}{' '}
                  <span className="tasto" aria-hidden="true">
                    D
                  </span>
                </Pulsante>
              </div>
            </article>
          )}
        </div>
      </div>
    </>
  );
}

/** Confronto affiancato: ogni differenza è evidenziata e scritta ("≠ diverso"). */
function Confronto({
  esistente,
  raccolto,
}: {
  esistente: EventoConfronto;
  raccolto: EventoConfronto;
}) {
  const c = d.colonne;
  return (
    <div className="confronto" role="table" aria-label={d.titolo}>
      <div role="row" className="contents">
        <div role="columnheader" className="cf-testa vuota">
          {c.campo}
        </div>
        <div role="columnheader" className="cf-testa">
          {c.esistente}
        </div>
        <div role="columnheader" className="cf-testa">
          {c.raccolto}
        </div>
        <div role="columnheader" className="cf-testa segno">
          {c.confronto}
        </div>
      </div>
      {CAMPI.map((campo) => {
        const prima = valore(esistente, campo);
        const dopo = valore(raccolto, campo);
        const diverso = prima.toLocaleLowerCase('it-IT') !== dopo.toLocaleLowerCase('it-IT');
        return (
          <div role="row" className="contents" key={campo}>
            <div role="rowheader" className="cf-campo">
              {d.campi[campo]}
            </div>
            <div role="cell" className={diverso ? 'cf-diff' : undefined}>
              {prima}
            </div>
            <div role="cell" className={diverso ? 'cf-diff' : undefined}>
              {dopo}
            </div>
            <div role="cell" className={diverso ? 'cf-segno diff' : 'cf-segno'}>
              {diverso ? d.diverso : d.uguale}
            </div>
          </div>
        );
      })}
    </div>
  );
}
