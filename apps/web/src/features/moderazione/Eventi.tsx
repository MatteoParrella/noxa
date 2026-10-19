'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, CircleCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDeferredValue, useState } from 'react';
import { Badge, type VarianteBadge } from '@/components/ui/Badge';
import { Campo } from '@/components/ui/Campo';
import { DialogoMotivazione } from '@/components/ui/DialogoMotivazione';
import { Icona } from '@/components/ui/Icona';
import { Pulsante } from '@/components/ui/Pulsante';
import { Caricamento, ElencoVuoto, ErroreConAzione } from '@/components/ui/Stati';
import { TabellaDensa, type ColonnaTabella } from '@/components/ui/TabellaDensa';
import { messaggi } from '@/lib/messaggi/it';
import {
  decidiAnnullamento,
  type EventoElencoModerazione,
  type PossibileAnnullamento,
  type StatoEvento,
} from './api';
import { CHIAVI, useContatori, useEventi, usePossibiliAnnullamenti } from './dati';
import { dataOra, etichettaEta, serata, testoErrore } from './formato';
import { PERCORSI_MODERAZIONE } from './GuscioModerazione';
import { Filtro, GruppoFiltri, Ricerca, Testata } from './Testata';

const testi = messaggi.moderazione;
const e = testi.eventi;
const LIMITE = 200;

const VARIANTI_STATO: Record<StatoEvento, VarianteBadge> = {
  pubblicato: 'successo',
  in_revisione: 'info',
  annullato: 'annullato',
  rifiutato: 'testo',
};

export function BadgeStatoEvento({ stato }: { stato: StatoEvento }) {
  return <Badge variante={VARIANTI_STATO[stato]}>{testi.stati.evento[stato]}</Badge>;
}

export function BadgeEta({ eta, dichiarata }: { eta: number; dichiarata: boolean }) {
  return <Badge variante={dichiarata ? 'eta' : 'avviso'}>{etichettaEta(eta, dichiarata)}</Badge>;
}

export function BadgeAlcol({ alcol }: { alcol: boolean }) {
  return alcol ? (
    <Badge variante="avviso">{testi.comune.si}</Badge>
  ) : (
    <Badge variante="testo">{testi.comune.no}</Badge>
  );
}

function schede(vista: 'ricerca' | 'annullamenti', annullamenti: number | undefined) {
  return [
    { href: PERCORSI_MODERAZIONE.eventi, etichetta: e.schede.ricerca, attiva: vista === 'ricerca' },
    {
      href: PERCORSI_MODERAZIONE.annullamenti,
      etichetta: e.schede.annullamenti,
      attiva: vista === 'annullamenti',
      extra:
        annullamenti !== undefined ? (
          <span className="t-mono-dato c-2">{annullamenti}</span>
        ) : undefined,
    },
  ];
}

/** Ricerca e correzione degli eventi, possibili annullamenti (tavola 06). */
export function Eventi() {
  const parametri = useSearchParams();
  return parametri.get('vista') === 'annullamenti' ? <PossibiliAnnullamenti /> : <RicercaEventi />;
}

function RicercaEventi() {
  const router = useRouter();
  const contatori = useContatori();
  const [testo, setTesto] = useState('');
  const [stati, setStati] = useState<StatoEvento[]>([]);
  const [dal, setDal] = useState('');
  const [al, setAl] = useState('');
  const testoRitardato = useDeferredValue(testo);
  const eventi = useEventi({
    testo: testoRitardato,
    stati,
    dal: dal || null,
    al: al || null,
    locale: null,
  });

  const alterna = (stato: StatoEvento) =>
    setStati((attuali) =>
      attuali.includes(stato) ? attuali.filter((s) => s !== stato) : [...attuali, stato],
    );

  const colonne: ReadonlyArray<ColonnaTabella<EventoElencoModerazione>> = [
    {
      chiave: 'serata',
      titolo: e.colonne.serata,
      cella: (ev) => serata(ev.data_serata),
      classe: 'mono',
    },
    {
      chiave: 'eta',
      titolo: e.colonne.eta,
      cella: (ev) => <BadgeEta eta={ev.eta_minima} dichiarata={ev.eta_minima_dichiarata} />,
    },
    {
      chiave: 'alcol',
      titolo: e.colonne.alcol,
      cella: (ev) => <BadgeAlcol alcol={ev.riferimenti_alcol} />,
    },
    {
      chiave: 'stato',
      titolo: e.colonne.stato,
      cella: (ev) => <BadgeStatoEvento stato={ev.stato} />,
    },
    {
      chiave: 'fonti',
      titolo: e.colonne.fonti,
      cella: (ev) => ev.fonti,
      classe: 'mono num nasc-390',
    },
  ];

  return (
    <>
      <Testata
        titolo={e.titolo}
        conta={eventi.data ? String(eventi.data.length) : undefined}
        strumenti={<Ricerca etichetta={e.cerca} valore={testo} onCambia={setTesto} />}
        schede={schede('ricerca', contatori.data?.possibili_annullamenti)}
        etichettaSchede={e.titolo}
        filtri={
          <>
            <GruppoFiltri etichetta={e.filtri.stato}>
              <Filtro attivo={stati.length === 0} onCambia={() => setStati([])}>
                {testi.comune.tutti}
              </Filtro>
              {(['pubblicato', 'in_revisione', 'annullato', 'rifiutato'] as const).map((stato) => (
                <Filtro key={stato} attivo={stati.includes(stato)} onCambia={() => alterna(stato)}>
                  {testi.stati.evento[stato]}
                </Filtro>
              ))}
            </GruppoFiltri>
            <div
              className="flex flex-wrap items-end gap-2"
              role="group"
              aria-label={e.filtri.serata}
            >
              <Campo
                etichetta={e.filtri.dal}
                type="date"
                value={dal}
                onChange={(ev) => setDal(ev.target.value)}
              />
              <Campo
                etichetta={e.filtri.al}
                type="date"
                value={al}
                onChange={(ev) => setAl(ev.target.value)}
              />
            </div>
          </>
        }
      />
      <div className="md-scorre">
        {eventi.isPending && <Caricamento descrizione={e.caricamento} righe={6} />}
        {eventi.isError && (
          <div className="pt-6">
            <ErroreConAzione
              titolo={testi.comune.erroreCaricamento.titolo}
              onRiprova={() => void eventi.refetch()}
              riprovaInCorso={eventi.isFetching}
            >
              {testi.comune.erroreCaricamento.testo}
            </ErroreConAzione>
          </div>
        )}
        {eventi.data?.length === 0 && (
          <div className="pt-6">
            <ElencoVuoto icona={CalendarDays} titolo={e.vuoto.titolo}>
              {e.vuoto.testo}
            </ElencoVuoto>
          </div>
        )}
        {eventi.data && eventi.data.length > 0 && (
          <>
            <TabellaDensa
              etichetta={e.titolo}
              titoloPrima={e.colonne.evento}
              colonne={colonne}
              righe={eventi.data}
              chiaveRiga={(ev) => ev.id}
              onApri={(ev) => router.push(PERCORSI_MODERAZIONE.evento(ev.id))}
              prima={(ev) => (
                <span className="cella-nome">
                  <Link href={PERCORSI_MODERAZIONE.evento(ev.id)} data-apri-riga>
                    {ev.titolo}
                  </Link>
                  <span>
                    {ev.locale_nome} · {ev.locale_comune}
                  </span>
                </span>
              )}
            />
            {eventi.data.length >= LIMITE && <p className="guida pt-3">{e.limite}</p>}
          </>
        )}
      </div>
    </>
  );
}

function PossibiliAnnullamenti() {
  const a = e.annullamenti;
  const client = useQueryClient();
  const contatori = useContatori();
  const annullamenti = usePossibiliAnnullamenti();
  const [daAnnullare, setDaAnnullare] = useState<PossibileAnnullamento | null>(null);
  const [fatto, setFatto] = useState<string | null>(null);
  const inProgramma = useMutation({
    mutationFn: (evento: PossibileAnnullamento) => decidiAnnullamento(evento.evento_id, false, ''),
    onSuccess: () => {
      setFatto(a.confermato);
      void client.invalidateQueries({ queryKey: CHIAVI.tutto });
    },
  });

  const colonne: ReadonlyArray<ColonnaTabella<PossibileAnnullamento>> = [
    {
      chiave: 'serata',
      titolo: a.colonne.serata,
      cella: (ev) => serata(ev.data_serata),
      classe: 'mono',
    },
    {
      chiave: 'ultima',
      titolo: a.colonne.ultimaVolta,
      cella: (ev) => dataOra(ev.ultima_conferma_il),
      classe: 'mono',
    },
    {
      chiave: 'partecipano',
      titolo: a.colonne.partecipano,
      cella: (ev) => (ev.ha_partecipanti ? a.partecipanoSi : a.partecipanoNo),
    },
    {
      chiave: 'decisione',
      titolo: a.colonne.decisione,
      cella: (ev) => (
        <span className="flex flex-wrap gap-2">
          <Pulsante dimensione="s" variante="secondario" onClick={() => inProgramma.mutate(ev)}>
            {a.inProgramma}
          </Pulsante>
          <Pulsante dimensione="s" variante="pericolo" onClick={() => setDaAnnullare(ev)}>
            {a.conferma}
          </Pulsante>
        </span>
      ),
    },
  ];

  return (
    <>
      <Testata
        titolo={e.titolo}
        conta={annullamenti.data ? String(annullamenti.data.length) : undefined}
        schede={schede('annullamenti', contatori.data?.possibili_annullamenti)}
        etichettaSchede={e.titolo}
      />
      <div className="md-scorre">
        <p className="guida pt-4">{a.spiegazione}</p>
        {fatto && (
          <div className="conferma-riga mt-3" role="status">
            <Icona icona={CircleCheck} dimensione="s" />
            {fatto}
          </div>
        )}
        {inProgramma.isError && <p className="campo-errore">{testoErrore(inProgramma.error)}</p>}
        {annullamenti.isPending && <Caricamento descrizione={a.caricamento} righe={3} />}
        {annullamenti.isError && (
          <ErroreConAzione
            titolo={testi.comune.erroreCaricamento.titolo}
            onRiprova={() => void annullamenti.refetch()}
            riprovaInCorso={annullamenti.isFetching}
          >
            {testi.comune.erroreCaricamento.testo}
          </ErroreConAzione>
        )}
        {annullamenti.data?.length === 0 && (
          <div className="pt-6">
            <ElencoVuoto icona={CalendarDays} titolo={a.vuoto.titolo}>
              {a.vuoto.testo}
            </ElencoVuoto>
          </div>
        )}
        {annullamenti.data && annullamenti.data.length > 0 && (
          <TabellaDensa
            etichetta={e.schede.annullamenti}
            titoloPrima={a.colonne.evento}
            colonne={colonne}
            righe={annullamenti.data}
            chiaveRiga={(ev) => ev.evento_id}
            prima={(ev) => (
              <span className="cella-nome">
                <Link href={PERCORSI_MODERAZIONE.evento(ev.evento_id)} data-apri-riga>
                  {ev.titolo}
                </Link>
                <span>
                  {ev.locale_nome} · {ev.fonte_url ?? ''}
                </span>
              </span>
            )}
          />
        )}
      </div>
      <DialogoMotivazione
        aperto={daAnnullare !== null}
        onChiudi={() => setDaAnnullare(null)}
        titolo={daAnnullare ? testi.evento.annullaTitolo(daAnnullare.titolo) : ''}
        sopratitolo={a.conferma.replace('…', '')}
        effetto={testi.evento.effettoAnnulla}
        etichettaMotivazione={testi.comune.motivazione}
        aiutoMotivazione={testi.comune.restaNelRegistro}
        erroreMotivazioneMancante={testi.comune.motivazioneMancante}
        etichettaConferma={testi.evento.annullaAzione}
        etichettaAnnulla={testi.comune.annulla}
        variante="pericolo"
        testoErrore={testoErrore}
        onConferma={async (motivazione) => {
          if (!daAnnullare) return;
          await decidiAnnullamento(daAnnullare.evento_id, true, motivazione);
          setDaAnnullare(null);
          setFatto(testi.evento.fatto.annullato);
          await client.invalidateQueries({ queryKey: CHIAVI.tutto });
        }}
      />
    </>
  );
}
