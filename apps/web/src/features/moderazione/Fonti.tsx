'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ban, Check, Clock, Plus, Rss, TriangleAlert, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Avviso } from '@/components/ui/Avviso';
import { Badge } from '@/components/ui/Badge';
import { Icona } from '@/components/ui/Icona';
import { Pulsante } from '@/components/ui/Pulsante';
import { Caricamento, ElencoVuoto, ErroreConAzione } from '@/components/ui/Stati';
import { TabellaDensa, type ColonnaTabella } from '@/components/ui/TabellaDensa';
import { messaggi } from '@/lib/messaggi/it';
import { eseguiOra, impostaFonteAttiva, type Conformita, type Fonte } from './api';
import { CHIAVI, useFonti } from './dati';
import { dataOra, testoErrore, urlBreve } from './formato';
import { PERCORSI_MODERAZIONE } from './GuscioModerazione';
import { Filtro, GruppoFiltri, Ricerca, Testata } from './Testata';

const testi = messaggi.moderazione;
const t = testi.fonti;

/** Conformità scritta con l'icona: mai solo colore (ADR-0008). */
export function BadgeConformita({ conformita }: { conformita: Conformita }) {
  const etichetta = testi.stati.conformita[conformita];
  if (conformita === 'consentita') {
    return (
      <Badge variante="successo">
        <Icona icona={Check} dimensione="s" />
        {etichetta}
      </Badge>
    );
  }
  if (conformita === 'vietata') {
    return (
      <Badge variante="errore">
        <Icona icona={Ban} dimensione="s" />
        {etichetta}
      </Badge>
    );
  }
  return (
    <Badge variante="avviso">
      <Icona icona={Clock} dimensione="s" />
      {etichetta}
    </Badge>
  );
}

export function BadgeAttiva({
  fonte,
}: {
  fonte: Pick<Fonte, 'attiva' | 'disattivata_automaticamente_il'>;
}) {
  if (fonte.attiva) return <Badge variante="successo">{testi.comune.si}</Badge>;
  if (fonte.disattivata_automaticamente_il) {
    return <Badge variante="errore">{testi.stati.spentaAuto}</Badge>;
  }
  return <Badge variante="testo">{testi.comune.no}</Badge>;
}

/** Esito dell'ultima esecuzione: letti, nuovi, uniti, errori (EVENT_INGESTION.md §8). */
export function EsitoBreve({ fonte }: { fonte: Fonte }) {
  const esito = fonte.ultimo_esito;
  if (fonte.tipo !== 'sito_locale' && fonte.tipo !== 'instagram') {
    return <span className="esito">{t.nessunAccordo}</span>;
  }
  if (!esito) return <span className="esito">—</span>;
  return (
    <span className="esito">
      <span>
        <b>{esito.eventi_letti ?? 0}</b> {t.esito.letti}
      </span>
      <span>
        <b>{esito.eventi_nuovi ?? 0}</b> {t.esito.nuovi}
      </span>
      <span>
        <b>{esito.eventi_uniti ?? 0}</b> {t.esito.uniti}
      </span>
      {fonte.errori_consecutivi > 0 && (
        <span className="err a-capo">
          {esito.codice_errore} · {t.esito.diFila(fonte.errori_consecutivi)}
        </span>
      )}
      {fonte.errori_consecutivi === 0 && fonte.esecuzioni_senza_eventi >= 3 && (
        <span className="err a-capo">{t.esito.senzaEventi(fonte.esecuzioni_senza_eventi)}</span>
      )}
    </span>
  );
}

export function nomeFonte(fonte: Fonte): string {
  return fonte.tipo === 'instagram' ? `@${fonte.url}` : urlBreve(fonte.url);
}

/** Elenco delle fonti (design/F-40-moderazione-fonti, tavola 04). */
export function Fonti() {
  const router = useRouter();
  const fonti = useFonti();
  const [testo, setTesto] = useState('');
  const [conformita, setConformita] = useState<Conformita | null>(null);
  const [soloAttive, setSoloAttive] = useState(false);
  const [conErrori, setConErrori] = useState(false);
  const [senzaEventi, setSenzaEventi] = useState(false);
  const [selezionata, setSelezionata] = useState<string | null>(null);

  const filtrate = useMemo(() => {
    const cerca = testo.trim().toLocaleLowerCase('it-IT').replace(/^@/, '');
    return (fonti.data ?? []).filter(
      (fonte) =>
        (!cerca ||
          fonte.locale.nome.toLocaleLowerCase('it-IT').includes(cerca) ||
          fonte.url.toLocaleLowerCase('it-IT').includes(cerca)) &&
        (!conformita || fonte.stato_conformita === conformita) &&
        (!soloAttive || fonte.attiva) &&
        (!conErrori ||
          fonte.errori_consecutivi > 0 ||
          fonte.disattivata_automaticamente_il !== null) &&
        (!senzaEventi || fonte.esecuzioni_senza_eventi >= 3),
    );
  }, [fonti.data, testo, conformita, soloAttive, conErrori, senzaEventi]);
  const dettaglio = filtrate.find((fonte) => fonte.id === selezionata) ?? null;

  const colonne: ReadonlyArray<ColonnaTabella<Fonte>> = [
    {
      chiave: 'adattatore',
      titolo: t.colonne.adattatore,
      cella: (f) => f.adattatore ?? '—',
      classe: 'mono nasc-1024',
    },
    {
      chiave: 'conformita',
      titolo: t.colonne.conformita,
      cella: (f) => <BadgeConformita conformita={f.stato_conformita} />,
    },
    { chiave: 'attiva', titolo: t.colonne.attiva, cella: (f) => <BadgeAttiva fonte={f} /> },
    {
      chiave: 'frequenza',
      titolo: t.colonne.frequenza,
      cella: (f) => (f.stato_conformita === 'consentita' ? t.frequenza(f.frequenza_minuti) : '—'),
      classe: 'mono nasc-390',
    },
    {
      chiave: 'ultima',
      titolo: t.colonne.ultima,
      cella: (f) =>
        f.ultima_esecuzione_il
          ? dataOra(f.ultima_esecuzione_il)
          : f.ultimo_esito?.prova
            ? t.soloProve
            : t.mai,
      classe: 'mono',
    },
    { chiave: 'esito', titolo: t.colonne.esito, cella: (f) => <EsitoBreve fonte={f} /> },
  ];

  return (
    <>
      <Testata
        titolo={t.titolo}
        conta={
          fonti.data
            ? filtrate.length === fonti.data.length
              ? String(fonti.data.length)
              : `${filtrate.length} di ${fonti.data.length}`
            : undefined
        }
        strumenti={
          <>
            <Ricerca etichetta={t.cerca} valore={testo} onCambia={setTesto} />
            <Link className="btn btn-principale" href={PERCORSI_MODERAZIONE.nuovaFonte()}>
              <Icona icona={Plus} dimensione="s" />
              {t.nuova}
            </Link>
          </>
        }
        filtri={
          <>
            <GruppoFiltri etichetta={t.filtri.conformita}>
              <Filtro attivo={conformita === null} onCambia={() => setConformita(null)}>
                {testi.comune.tutte}
              </Filtro>
              {(['da_verificare', 'consentita', 'vietata'] as const).map((valore) => (
                <Filtro
                  key={valore}
                  attivo={conformita === valore}
                  onCambia={() => setConformita(valore)}
                >
                  {testi.stati.conformita[valore]}
                </Filtro>
              ))}
            </GruppoFiltri>
            <Filtro attivo={soloAttive} onCambia={() => setSoloAttive((v) => !v)}>
              {t.filtri.attive}
            </Filtro>
            <Filtro attivo={conErrori} onCambia={() => setConErrori((v) => !v)}>
              {t.filtri.conErrori}
            </Filtro>
            <Filtro attivo={senzaEventi} onCambia={() => setSenzaEventi((v) => !v)}>
              {t.filtri.senzaEventi}
            </Filtro>
          </>
        }
      />
      <div className="md-contenuto">
        <div className="md-scorre">
          {fonti.isPending && <Caricamento descrizione={t.caricamento} righe={6} />}
          {fonti.isError && (
            <div className="pt-6">
              <ErroreConAzione
                titolo={testi.comune.erroreCaricamento.titolo}
                onRiprova={() => void fonti.refetch()}
                riprovaInCorso={fonti.isFetching}
              >
                {testi.comune.erroreCaricamento.testo}
              </ErroreConAzione>
            </div>
          )}
          {fonti.data && filtrate.length === 0 && (
            <div className="pt-6">
              <ElencoVuoto icona={Rss} titolo={t.vuoto.titolo}>
                {t.vuoto.testo}
              </ElencoVuoto>
            </div>
          )}
          {filtrate.length > 0 && (
            <TabellaDensa
              etichetta={t.titolo}
              titoloPrima={t.colonne.fonte}
              colonne={colonne}
              righe={filtrate}
              chiaveRiga={(f) => f.id}
              selezionata={selezionata}
              onApri={(f) =>
                f.disattivata_automaticamente_il || f.errori_consecutivi > 0
                  ? setSelezionata(f.id)
                  : router.push(PERCORSI_MODERAZIONE.fonte(f.id))
              }
              prima={(f) => (
                <span className="cella-nome">
                  <Link href={PERCORSI_MODERAZIONE.fonte(f.id)} data-apri-riga>
                    {f.locale.nome} · {t.tipi[f.tipo]}
                  </Link>
                  <span className="t-mono-dato">{nomeFonte(f)}</span>
                </span>
              )}
            />
          )}
        </div>
        {dettaglio && <PannelloErrori fonte={dettaglio} onChiudi={() => setSelezionata(null)} />}
      </div>
    </>
  );
}

/** Pannello di una fonte con errori: ultimo errore, "Esegui ora" e "Riattiva". */
function PannelloErrori({ fonte, onChiudi }: { fonte: Fonte; onChiudi: () => void }) {
  const client = useQueryClient();
  const azione = useMutation({
    mutationFn: (tipo: 'esegui' | 'riattiva') =>
      tipo === 'esegui'
        ? eseguiOra(fonte.id).then(() => undefined)
        : impostaFonteAttiva(fonte.id, true),
    onSuccess: () => void client.invalidateQueries({ queryKey: CHIAVI.tutto }),
  });
  return (
    <aside className="md-pannello" aria-labelledby="pannello-fonte">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="etichetta m-0">
            {fonte.locale.nome} · {t.tipi[fonte.tipo]}
          </p>
          <h2 id="pannello-fonte">{nomeFonte(fonte)}</h2>
        </div>
        <Pulsante variante="neutro" soloIcona aria-label={testi.comune.annulla} onClick={onChiudi}>
          <Icona icona={X} />
        </Pulsante>
      </div>
      <span className="flex flex-wrap gap-1">
        <BadgeConformita conformita={fonte.stato_conformita} />
        <BadgeAttiva fonte={fonte} />
      </span>
      {fonte.disattivata_automaticamente_il && (
        <Avviso tipo="errore" titolo={t.disattivataAutoTitolo}>
          {t.disattivataAuto(
            dataOra(fonte.disattivata_automaticamente_il),
            fonte.ultimo_errore ?? '',
          )}
        </Avviso>
      )}
      {!fonte.disattivata_automaticamente_il && fonte.ultimo_errore && (
        <Avviso tipo="avviso">
          <Icona icona={TriangleAlert} dimensione="s" /> {fonte.ultimo_errore}
        </Avviso>
      )}
      {azione.isError && <Avviso tipo="errore">{testoErrore(azione.error)}</Avviso>}
      {azione.isSuccess && (
        <p className="guida" role="status">
          {testi.fonte.inCoda}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Pulsante
          variante="secondario"
          onClick={() => azione.mutate('esegui')}
          caricamento={azione.isPending}
        >
          {testi.fonte.eseguiOra}
        </Pulsante>
        {!fonte.attiva && fonte.stato_conformita === 'consentita' && (
          <Pulsante variante="principale" onClick={() => azione.mutate('riattiva')}>
            {messaggi.moderazione.scheda.riattiva}
          </Pulsante>
        )}
      </div>
      <Link className="link-accesso" href={PERCORSI_MODERAZIONE.fonte(fonte.id)}>
        {t.apriScheda}
      </Link>
    </aside>
  );
}
