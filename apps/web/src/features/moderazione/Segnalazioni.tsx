'use client';

import { AlertTriangle, Flag, Lock } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Badge, type VarianteBadge } from '@/components/ui/Badge';
import { Icona } from '@/components/ui/Icona';
import { Caricamento, ElencoVuoto, ErroreConAzione } from '@/components/ui/Stati';
import { TabellaDensa, type ColonnaTabella } from '@/components/ui/TabellaDensa';
import { classi } from '@/lib/classi';
import { messaggi } from '@/lib/messaggi/it';
import type { SegnalazioneCoda } from './api';
import { useAdesso, useCodaSegnalazioni, useContatori } from './dati';
import { oraBreve, SCADENZA_VICINA_MS, tempoRimanente } from './formato';
import { PERCORSI_MODERAZIONE } from './GuscioModerazione';
import { Filtro, GruppoFiltri, Testata } from './Testata';

const testi = messaggi.moderazione;
const c = testi.codaSegnalazioni;

type StatoSegnalazione = SegnalazioneCoda['stato'];

const VARIANTI_PRIORITA: Record<number, VarianteBadge> = { 1: 'errore', 2: 'avviso', 3: 'tenue' };

export function BadgePriorita({ priorita }: { priorita: number }) {
  return (
    <Badge variante={VARIANTI_PRIORITA[priorita] ?? 'tenue'} className="prio">
      {c.priorita[priorita] ?? `P${priorita}`}
    </Badge>
  );
}

export function BadgeStatoSegnalazione({
  stato,
  presaDaMe,
  presaDa,
  inEscalation,
}: {
  stato: StatoSegnalazione;
  presaDaMe: boolean;
  presaDa: string | null;
  inEscalation: boolean;
}) {
  if (inEscalation) return <Badge variante="errore">{c.inEscalation}</Badge>;
  if (stato === 'in_lavorazione') {
    return (
      <Badge variante={presaDaMe ? 'accento' : 'info'}>
        {presaDaMe ? c.inCaricoAMe : presaDa ? c.inCaricoA(presaDa) : c.stati.in_lavorazione}
      </Badge>
    );
  }
  return <Badge variante={stato === 'chiusa' ? 'testo' : 'tenue'}>{c.stati[stato]}</Badge>;
}

/** Tempo che resta prima della scadenza di R-53, scritto: non solo colore. */
export function TempoRimanente({
  scadenza,
  adesso,
  chiusa,
}: {
  scadenza: string;
  adesso: number;
  chiusa: boolean;
}) {
  if (chiusa) return <span className="tempo">{c.tempo.chiusa}</span>;
  const resta = new Date(scadenza).getTime() - adesso;
  const ora = oraBreve(scadenza);
  if (resta <= 0) {
    return (
      <span className="tempo vicina">
        <span className="scade">
          <Icona icona={AlertTriangle} dimensione="s" />
          {c.tempo.scaduta}
        </span>
        <small>{testi.urgente.scaduta(ora)}</small>
      </span>
    );
  }
  const vicina = resta <= SCADENZA_VICINA_MS;
  return (
    <span className={classi('tempo', vicina && 'vicina')}>
      <b>{tempoRimanente(resta)}</b>
      <small>
        {vicina ? `${c.tempo.vicina} · ` : ''}
        {c.tempo.scadeAlle(ora)}
      </small>
    </span>
  );
}

export function schedeSegnalazioni(
  attiva: 'segnalazioni' | 'reclami',
  reclami: number | undefined,
) {
  return [
    {
      href: PERCORSI_MODERAZIONE.segnalazioni,
      etichetta: c.schede.segnalazioni,
      attiva: attiva === 'segnalazioni',
    },
    {
      href: PERCORSI_MODERAZIONE.reclami,
      etichetta: c.schede.reclami,
      attiva: attiva === 'reclami',
      extra: reclami !== undefined ? <span className="t-mono-dato c-2">{reclami}</span> : undefined,
    },
  ];
}

const TIPI = ['profilo', 'foto_profilo', 'evento', 'immagine_locale', 'caricamento_flyer'] as const;
const STATI: StatoSegnalazione[] = ['aperta', 'in_lavorazione', 'chiusa'];

function alterna<T>(elenco: T[], valore: T): T[] {
  return elenco.includes(valore) ? elenco.filter((v) => v !== valore) : [...elenco, valore];
}

/**
 * Coda delle segnalazioni (tavola 13) per priorità e scadenza (R-53). Il contenuto non si
 * vede nella lista: si apre solo dal dettaglio, che registra l'accesso (R-69).
 */
export function Segnalazioni() {
  const router = useRouter();
  const coda = useCodaSegnalazioni();
  const contatori = useContatori();
  const adesso = useAdesso();
  const [priorita, setPriorita] = useState<number[]>([]);
  const [tipi, setTipi] = useState<string[]>([]);
  const [stati, setStati] = useState<StatoSegnalazione[]>([]);
  const [mie, setMie] = useState(false);

  const righe = (coda.data ?? []).filter(
    (s) =>
      (priorita.length === 0 || priorita.includes(s.priorita)) &&
      (tipi.length === 0 || tipi.includes(s.tipo_oggetto)) &&
      (stati.length === 0 || stati.includes(s.stato)) &&
      (!mie || s.presa_da_me),
  );
  const aperte = (coda.data ?? []).filter((s) => s.stato !== 'chiusa').length;

  const colonne: ReadonlyArray<ColonnaTabella<SegnalazioneCoda>> = [
    {
      chiave: 'tempo',
      titolo: c.colonne.tempo,
      cella: (s) => (
        <TempoRimanente scadenza={s.scadenza} adesso={adesso} chiusa={s.stato === 'chiusa'} />
      ),
    },
    {
      chiave: 'tipo',
      titolo: c.colonne.tipo,
      cella: (s) => c.tipi[s.tipo_oggetto] ?? s.tipo_oggetto,
    },
    {
      chiave: 'motivo',
      titolo: c.colonne.motivo,
      cella: (s) => c.motivi[s.motivo] ?? s.motivo,
      classe: 'nasc-390',
    },
    {
      chiave: 'quante',
      titolo: c.colonne.quante,
      cella: (s) => s.stesso_oggetto,
      classe: 'mono num nasc-1024',
    },
    {
      chiave: 'stato',
      titolo: c.colonne.stato,
      cella: (s) => (
        <BadgeStatoSegnalazione
          stato={s.stato}
          presaDaMe={s.presa_da_me}
          presaDa={s.presa_da}
          inEscalation={s.in_escalation}
        />
      ),
    },
  ];

  return (
    <>
      <Testata
        titolo={c.titolo}
        conta={coda.data ? String(aperte) : undefined}
        strumenti={
          <span className="riservato">
            <Icona icona={Lock} dimensione="s" />
            {c.riservato}
          </span>
        }
        schede={schedeSegnalazioni('segnalazioni', contatori.data?.reclami)}
        etichettaSchede={c.titolo}
        filtri={
          <>
            <GruppoFiltri etichetta={c.filtri.priorita}>
              <Filtro attivo={priorita.length === 0} onCambia={() => setPriorita([])}>
                {testi.comune.tutte}
              </Filtro>
              {[1, 2, 3].map((p) => (
                <Filtro
                  key={p}
                  attivo={priorita.includes(p)}
                  onCambia={() => setPriorita((a) => alterna(a, p))}
                >
                  {c.priorita[p]}
                </Filtro>
              ))}
            </GruppoFiltri>
            <GruppoFiltri etichetta={c.filtri.tipo}>
              <Filtro attivo={tipi.length === 0} onCambia={() => setTipi([])}>
                {testi.comune.tutti}
              </Filtro>
              {TIPI.map((t) => (
                <Filtro
                  key={t}
                  attivo={tipi.includes(t)}
                  onCambia={() => setTipi((a) => alterna(a, t))}
                >
                  {c.tipi[t]}
                </Filtro>
              ))}
            </GruppoFiltri>
            <GruppoFiltri etichetta={c.filtri.stato}>
              <Filtro attivo={stati.length === 0} onCambia={() => setStati([])}>
                {testi.comune.tutti}
              </Filtro>
              {STATI.map((s) => (
                <Filtro
                  key={s}
                  attivo={stati.includes(s)}
                  onCambia={() => setStati((a) => alterna(a, s))}
                >
                  {c.stati[s]}
                </Filtro>
              ))}
              <Filtro attivo={mie} onCambia={() => setMie((m) => !m)}>
                {c.filtri.mie}
              </Filtro>
            </GruppoFiltri>
          </>
        }
      />
      <div className="md-scorre">
        {coda.isPending && <Caricamento descrizione={c.caricamento} righe={6} />}
        {coda.isError && (
          <div className="pt-6">
            <ErroreConAzione
              titolo={testi.comune.erroreCaricamento.titolo}
              onRiprova={() => void coda.refetch()}
              riprovaInCorso={coda.isFetching}
            >
              {testi.comune.erroreCaricamento.testo}
            </ErroreConAzione>
          </div>
        )}
        {coda.data && righe.length === 0 && (
          <div className="pt-6">
            {coda.data.length === 0 ? (
              <ElencoVuoto icona={Flag} titolo={c.vuoto.titolo}>
                {c.vuoto.testo}
              </ElencoVuoto>
            ) : (
              <ElencoVuoto icona={Flag} titolo={c.vuotoFiltri.titolo}>
                {c.vuotoFiltri.testo}
              </ElencoVuoto>
            )}
          </div>
        )}
        {righe.length > 0 && (
          <TabellaDensa
            etichetta={c.titolo}
            titoloPrima={c.colonne.priorita}
            colonne={colonne}
            righe={righe}
            chiaveRiga={(s) => s.id}
            onApri={(s) => router.push(PERCORSI_MODERAZIONE.segnalazione(s.id))}
            prima={(s) => (
              <span className="cella-nome">
                <Link href={PERCORSI_MODERAZIONE.segnalazione(s.id)} data-apri-riga>
                  <BadgePriorita priorita={s.priorita} />
                </Link>
              </span>
            )}
          />
        )}
      </div>
    </>
  );
}
