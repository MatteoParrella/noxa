'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CircleCheck, Info } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Avviso } from '@/components/ui/Avviso';
import { Badge } from '@/components/ui/Badge';
import { Campo } from '@/components/ui/Campo';
import { DialogoMotivazione } from '@/components/ui/DialogoMotivazione';
import { Icona } from '@/components/ui/Icona';
import { Pulsante } from '@/components/ui/Pulsante';
import { Segmenti } from '@/components/ui/Segmenti';
import { Selezione } from '@/components/ui/Selezione';
import { Caricamento, ErroreConAzione } from '@/components/ui/Stati';
import { TabellaDensa, type ColonnaTabella } from '@/components/ui/TabellaDensa';
import { messaggi } from '@/lib/messaggi/it';
import {
  eseguiOra,
  impostaFonteAttiva,
  leggiEsecuzioni,
  registraMotivazione,
  salvaFonte,
  segnaFonteVietata,
  type Conformita,
  type DatiFonte,
  type Esecuzione,
  type EsitoRobots,
  type Fonte,
  type TipoFonte,
} from './api';
import { CHIAVI, useEsecuzioni, useFonte, useLocali } from './dati';
import { BadgeAttiva, BadgeConformita, nomeFonte } from './Fonti';
import { data, dataOra, durata, oraBreve, testoErrore, urlBreve } from './formato';
import { PERCORSI_MODERAZIONE } from './GuscioModerazione';
import { RegistroOggetto } from './RegistroOggetto';
import { Testata } from './Testata';

const testi = messaggi.moderazione;
const f = testi.fonte;

type Famiglia = 'sito_locale' | 'instagram' | 'aggregatore';
type Aggregatore = 'resident_advisor' | 'xceed' | 'dice';
const ADATTATORI: Record<Famiglia, string[]> = {
  sito_locale: ['sito_jsonld'],
  instagram: ['instagram_business_discovery'],
  aggregatore: [],
};

type Modulo = {
  locale_id: string;
  famiglia: Famiglia;
  aggregatore: Aggregatore;
  url: string;
  adattatore: string;
  frequenza_minuti: number;
  pagine_massime: string;
  stato_conformita: Conformita;
  robots_esito: EsitoRobots | '';
  termini_url: string;
  termini_letti_il: string;
  note_conformita: string;
};

type Errori = Partial<
  Record<
    'locale_id' | 'url' | 'adattatore' | 'pagine' | 'robots' | 'termini_url' | 'termini_letti_il',
    string
  >
>;

function famigliaDi(tipo: TipoFonte): Famiglia {
  return tipo === 'sito_locale' || tipo === 'instagram' ? tipo : 'aggregatore';
}

function moduloDa(fonte: Fonte | null, locale: string | null): Modulo {
  const famiglia = fonte ? famigliaDi(fonte.tipo) : 'sito_locale';
  return {
    locale_id: fonte?.locale_id ?? locale ?? '',
    famiglia,
    aggregatore:
      fonte && famiglia === 'aggregatore' ? (fonte.tipo as Aggregatore) : 'resident_advisor',
    url: fonte?.url ?? '',
    adattatore: fonte?.adattatore ?? ADATTATORI[famiglia][0] ?? '',
    frequenza_minuti: fonte?.frequenza_minuti ?? 360,
    pagine_massime: String(fonte?.pagine_massime ?? 10),
    stato_conformita: fonte?.stato_conformita ?? 'da_verificare',
    robots_esito: fonte?.robots_esito ?? '',
    termini_url: fonte?.termini_url ?? '',
    termini_letti_il: fonte?.termini_letti_il ?? '',
    note_conformita: fonte?.note_conformita ?? '',
  };
}

function valida(modulo: Modulo): Errori {
  const errori: Errori = {};
  if (!modulo.locale_id) errori.locale_id = f.errori.locale;
  if (modulo.famiglia === 'instagram') {
    if (!/^@?[A-Za-z0-9_.]{1,30}$/.test(modulo.url.trim())) errori.url = f.errori.username;
  } else if (!/^https?:\/\/[^/\s]+\S*$/.test(modulo.url.trim())) {
    errori.url = f.errori.url;
  }
  const pagine = Number(modulo.pagine_massime);
  if (!Number.isInteger(pagine) || pagine < 1 || pagine > 50) errori.pagine = f.errori.pagine;
  if (modulo.stato_conformita === 'consentita') {
    if (!modulo.adattatore) errori.adattatore = f.errori.adattatore;
    if (!modulo.robots_esito) errori.robots = f.errori.robots;
    if (!/^https?:\/\/\S+$/.test(modulo.termini_url.trim())) errori.termini_url = f.errori.termini;
    if (!modulo.termini_letti_il) errori.termini_letti_il = f.terminiLettiErrore;
  }
  return errori;
}

function datiDa(modulo: Modulo): DatiFonte {
  const tipo: TipoFonte = modulo.famiglia === 'aggregatore' ? modulo.aggregatore : modulo.famiglia;
  return {
    locale_id: modulo.locale_id,
    tipo,
    url: modulo.famiglia === 'instagram' ? modulo.url.trim().replace(/^@/, '') : modulo.url.trim(),
    adattatore: modulo.adattatore || null,
    frequenza_minuti: modulo.frequenza_minuti,
    pagine_massime: Number(modulo.pagine_massime),
    stato_conformita: modulo.stato_conformita,
    robots_esito: modulo.famiglia === 'instagram' ? 'non_applicabile' : modulo.robots_esito || null,
    termini_url: modulo.termini_url.trim() || null,
    termini_letti_il: modulo.termini_letti_il || null,
    note_conformita: modulo.note_conformita.trim() || null,
  };
}

const ATTESA_ESECUZIONE_MS = 3 * 60_000;

/**
 * "Esegui ora": accoda il job e aspetta l'esito, controllando le esecuzioni ogni 5 secondi
 * per al massimo 3 minuti (poi l'esito resta nell'elenco quando arriva).
 */
async function attendiEsecuzione(fonteId: string): Promise<Esecuzione | null> {
  const inizio = Date.now();
  await eseguiOra(fonteId);
  while (Date.now() - inizio < ATTESA_ESECUZIONE_MS) {
    await new Promise((risolvi) => setTimeout(risolvi, 5_000));
    const nuova = (await leggiEsecuzioni(fonteId)).find(
      (esecuzione) => new Date(esecuzione.iniziata_il).getTime() >= inizio - 60_000,
    );
    if (nuova) return nuova;
  }
  return null;
}

/** Nuova fonte o scheda di una fonte (design/F-40-moderazione-fonti, tavola 04). */
export function SchedaFonte() {
  const parametri = useSearchParams();
  const id = parametri.get('id');
  const fonte = useFonte(id);
  if (id && fonte.isPending) return <Caricamento descrizione={f.caricamento} righe={6} />;
  if (id && fonte.isError) {
    return (
      <div className="md-scorre pt-6">
        <ErroreConAzione
          titolo={testi.comune.erroreCaricamento.titolo}
          onRiprova={() => void fonte.refetch()}
          riprovaInCorso={fonte.isFetching}
        >
          {testi.comune.erroreCaricamento.testo}
        </ErroreConAzione>
      </div>
    );
  }
  if (id && !fonte.data) {
    return (
      <div className="md-scorre pt-6">
        <Avviso tipo="avviso">{testi.comune.nonTrovato}</Avviso>
      </div>
    );
  }
  return (
    <ModuloFonte
      key={`${id ?? 'nuova'}-${fonte.data?.verificata_il ?? ''}-${String(fonte.data?.attiva)}`}
      fonte={fonte.data ?? null}
      localeIniziale={parametri.get('locale')}
    />
  );
}

function ModuloFonte({
  fonte,
  localeIniziale,
}: {
  fonte: Fonte | null;
  localeIniziale: string | null;
}) {
  const router = useRouter();
  const client = useQueryClient();
  const locali = useLocali();
  const [modulo, setModulo] = useState<Modulo>(() => moduloDa(fonte, localeIniziale));
  const [errori, setErrori] = useState<Errori>({});
  const [salvato, setSalvato] = useState(false);
  const [vietata, setVietata] = useState(false);
  const esecuzioni = useEsecuzioni(fonte?.id ?? null);
  const [ultimaArrivata, setUltimaArrivata] = useState<Esecuzione | null>(null);

  const cambia = <K extends keyof Modulo>(chiave: K, valore: Modulo[K]) => {
    setModulo((attuale) => ({ ...attuale, [chiave]: valore }));
    setSalvato(false);
  };
  const cambiaFamiglia = (famiglia: Famiglia) =>
    setModulo((attuale) => ({
      ...attuale,
      famiglia,
      adattatore: ADATTATORI[famiglia][0] ?? '',
      frequenza_minuti:
        famiglia === 'instagram'
          ? Math.max(attuale.frequenza_minuti, 720)
          : attuale.frequenza_minuti,
      robots_esito:
        famiglia === 'instagram'
          ? 'non_applicabile'
          : attuale.robots_esito === 'non_applicabile'
            ? ''
            : attuale.robots_esito,
      stato_conformita: famiglia === 'aggregatore' ? 'vietata' : attuale.stato_conformita,
    }));

  const salvataggio = useMutation({
    mutationFn: () => salvaFonte(fonte?.id ?? null, datiDa(modulo)),
    onSuccess: (nuovoId) => {
      setSalvato(true);
      void client.invalidateQueries({ queryKey: CHIAVI.tutto });
      if (!fonte) router.replace(PERCORSI_MODERAZIONE.fonte(nuovoId));
    },
  });
  const azione = useMutation({
    mutationFn: async (tipo: 'esegui' | 'attiva' | 'disattiva') => {
      if (!fonte) return null;
      if (tipo !== 'esegui') {
        await impostaFonteAttiva(fonte.id, tipo === 'attiva');
        return null;
      }
      setUltimaArrivata(null);
      return attendiEsecuzione(fonte.id);
    },
    onSuccess: (esecuzione) => {
      if (esecuzione) setUltimaArrivata(esecuzione);
      void client.invalidateQueries({ queryKey: CHIAVI.tutto });
    },
  });

  function invia(evento: FormEvent) {
    evento.preventDefault();
    const trovati = valida(modulo);
    setErrori(trovati);
    if (Object.keys(trovati).length === 0) salvataggio.mutate();
  }

  const titolo = fonte ? nomeFonte(fonte) : f.nuova;
  const consentita = fonte?.stato_conformita === 'consentita' && Boolean(fonte.adattatore);
  const dominio =
    modulo.famiglia !== 'instagram' ? /^https?:\/\/([^/]+)/.exec(modulo.url)?.[1] : null;
  const frequenze = ([360, 720, 1440] as const).filter(
    (m) => modulo.famiglia !== 'instagram' || m >= 720,
  );

  return (
    <>
      <Testata
        briciole={
          <nav className="briciole" aria-label={testi.fonti.titolo}>
            <Link href={PERCORSI_MODERAZIONE.fonti}>{testi.fonti.titolo}</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">
              {fonte ? `${fonte.locale.nome} · ${testi.fonti.tipi[fonte.tipo]}` : f.nuova}
            </span>
          </nav>
        }
        titolo={
          <>
            {titolo}
            <BadgeConformita conformita={fonte?.stato_conformita ?? modulo.stato_conformita} />
            {fonte && <BadgeAttiva fonte={fonte} />}
          </>
        }
        strumenti={
          fonte && (
            <>
              <Pulsante
                variante="secondario"
                disabled={!consentita}
                caricamento={azione.isPending && azione.variables === 'esegui'}
                onClick={() => azione.mutate('esegui')}
              >
                {f.eseguiOra}
              </Pulsante>
              {fonte.attiva ? (
                <Pulsante variante="secondario" onClick={() => azione.mutate('disattiva')}>
                  {f.disattiva}
                </Pulsante>
              ) : (
                <Pulsante
                  variante="secondario"
                  disabled={!consentita}
                  aria-describedby={!consentita ? 'attiva-spenta' : undefined}
                  onClick={() => azione.mutate('attiva')}
                >
                  {f.attiva}
                </Pulsante>
              )}
              {fonte.stato_conformita !== 'vietata' && (
                <Pulsante variante="pericolo" onClick={() => setVietata(true)}>
                  {f.segnaVietata}
                </Pulsante>
              )}
            </>
          )
        }
      />
      <div className="md-scorre">
        <div className="md-due">
          <div className="md-col">
            {fonte && !consentita && (
              <p id="attiva-spenta" className="guida">
                {fonte.stato_conformita === 'vietata' ? f.vietataAvviso : f.nonAttivabile}
              </p>
            )}
            {!fonte && <p className="guida">{f.nonAttivabile}</p>}
            {azione.isPending && azione.variables === 'esegui' && (
              <p className="guida" role="status">
                {f.inCoda}
              </p>
            )}
            {ultimaArrivata && (
              <div className="conferma-riga" role="status">
                <Icona icona={CircleCheck} dimensione="s" />
                {f.esecuzioneArrivata(
                  oraBreve(ultimaArrivata.iniziata_il),
                  ultimaArrivata.eventi_letti,
                  ultimaArrivata.eventi_nuovi,
                )}
              </div>
            )}
            {azione.isError && <Avviso tipo="errore">{testoErrore(azione.error)}</Avviso>}
            {salvato && (
              <div className="conferma-riga" role="status">
                <Icona icona={CircleCheck} dimensione="s" />
                {fonte ? testi.comune.salvato : f.creata}
              </div>
            )}
            {salvataggio.isError && (
              <Avviso tipo="errore" titolo={testi.comune.erroreSalvataggio.titolo} portaInVista>
                {testoErrore(salvataggio.error)}
              </Avviso>
            )}
            <form id="modulo-fonte" className="flex flex-col gap-4" onSubmit={invia} noValidate>
              <section className="md-sezione">
                <h2 className="etichetta-riga">{f.sezioneFonte}</h2>
                <div className="campi2">
                  <Selezione
                    etichetta={f.locale}
                    valore={modulo.locale_id}
                    segnaposto={f.scegliLocale}
                    opzioni={(locali.data ?? []).map((l) => ({
                      valore: l.id,
                      etichetta: `${l.nome} · ${l.comune}`,
                    }))}
                    onCambia={(valore) => cambia('locale_id', valore)}
                    errore={errori.locale_id}
                  />
                  <div className="selezione">
                    <span className="campo-etichetta" id="tipo-fonte">
                      {f.tipo}
                    </span>
                    <Segmenti
                      etichetta={f.tipo}
                      valore={modulo.famiglia}
                      opzioni={[
                        { valore: 'sito_locale', etichetta: f.tipi.sito_locale },
                        { valore: 'instagram', etichetta: f.tipi.instagram },
                        { valore: 'aggregatore', etichetta: f.tipi.aggregatore },
                      ]}
                      onCambia={cambiaFamiglia}
                    />
                  </div>
                  <Campo
                    etichetta={modulo.famiglia === 'instagram' ? f.username : f.url}
                    value={modulo.url}
                    type={modulo.famiglia === 'instagram' ? 'text' : 'url'}
                    errore={errori.url}
                    onChange={(e) => cambia('url', e.target.value)}
                  />
                  <Selezione
                    etichetta={f.adattatore}
                    valore={modulo.adattatore}
                    segnaposto={f.nessunAdattatore}
                    opzioni={ADATTATORI[modulo.famiglia].map((nome) => ({
                      valore: nome,
                      etichetta: (f.adattatori as Record<string, string>)[nome] ?? nome,
                    }))}
                    onCambia={(valore) => cambia('adattatore', valore)}
                    errore={errori.adattatore}
                    disabled={modulo.famiglia === 'aggregatore'}
                  />
                  <Selezione
                    etichetta={f.frequenza}
                    valore={String(modulo.frequenza_minuti)}
                    opzioni={frequenze.map((minuti) => ({
                      valore: String(minuti),
                      etichetta: f.frequenze[minuti],
                    }))}
                    onCambia={(valore) => cambia('frequenza_minuti', Number(valore))}
                    aiuto={f.frequenzaAiuto}
                  />
                  <Campo
                    etichetta={f.pagine}
                    type="number"
                    min={1}
                    max={50}
                    value={modulo.pagine_massime}
                    aiuto={f.pagineAiuto}
                    errore={errori.pagine}
                    onChange={(e) => cambia('pagine_massime', e.target.value)}
                  />
                </div>
              </section>

              <section className="md-sezione">
                <h2 className="etichetta-riga">{f.verifica}</h2>
                {modulo.famiglia === 'aggregatore' ? (
                  <Avviso tipo="avviso">{f.aggregatoreVietato}</Avviso>
                ) : (
                  <>
                    {modulo.famiglia !== 'instagram' && (
                      <>
                        <Selezione
                          etichetta={f.robots}
                          valore={modulo.robots_esito}
                          segnaposto={f.robotsScegli}
                          opzioni={(['consentito', 'vietato'] as const).map((valore) => ({
                            valore,
                            etichetta: f.robotsOpzioni[valore],
                          }))}
                          onCambia={(valore) => cambia('robots_esito', valore)}
                          errore={errori.robots}
                        />
                        {dominio && (
                          <a
                            className="link-in-testo t-mono-dato"
                            href={`https://${dominio}/robots.txt`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {f.robotsLink(dominio)}
                          </a>
                        )}
                      </>
                    )}
                    {modulo.famiglia === 'instagram' && (
                      <p className="guida">{f.robotsOpzioni.non_applicabile}</p>
                    )}
                    <div className="campi2">
                      <Campo
                        etichetta={f.termini}
                        type="url"
                        value={modulo.termini_url}
                        placeholder="https://"
                        errore={errori.termini_url}
                        onChange={(e) => cambia('termini_url', e.target.value)}
                      />
                      <Campo
                        etichetta={f.terminiLetti}
                        type="date"
                        value={modulo.termini_letti_il}
                        errore={errori.termini_letti_il}
                        onChange={(e) => cambia('termini_letti_il', e.target.value)}
                      />
                    </div>
                  </>
                )}
                <p className="guida">{f.campiRaccolti}</p>
                <div className="motivazione">
                  <label className="campo-etichetta" htmlFor="note-conformita">
                    {f.note}
                  </label>
                  <textarea
                    id="note-conformita"
                    value={modulo.note_conformita}
                    maxLength={2000}
                    aria-describedby="note-aiuto"
                    onChange={(e) => cambia('note_conformita', e.target.value)}
                  />
                  <span className="guida" id="note-aiuto">
                    {f.noteAiuto}
                  </span>
                </div>
                <div className="selezione">
                  <span className="campo-etichetta">{f.esito}</span>
                  <Segmenti
                    etichetta={f.esito}
                    valore={modulo.stato_conformita}
                    opzioni={(['da_verificare', 'consentita', 'vietata'] as const)
                      .filter(
                        (valore) => modulo.famiglia !== 'aggregatore' || valore !== 'consentita',
                      )
                      .map((valore) => ({ valore, etichetta: f.esitoOpzioni[valore] }))}
                    onCambia={(valore) => cambia('stato_conformita', valore)}
                  />
                </div>
                <div>
                  <Pulsante type="submit" variante="principale" caricamento={salvataggio.isPending}>
                    {f.salva}
                  </Pulsante>
                </div>
              </section>
            </form>
            {fonte && (
              <ElencoEsecuzioni esecuzioni={esecuzioni.data} caricamento={esecuzioni.isPending} />
            )}
          </div>
          <div className="md-col">
            {fonte ? (
              <>
                <RiepilogoConformita fonte={fonte} />
                <RegistroOggetto tipo="fonte" id={fonte.id} />
              </>
            ) : (
              <section className="md-sezione">
                <h2 className="etichetta-riga">{f.regole}</h2>
                <div className="effetto">
                  <Icona icona={Info} dimensione="s" />
                  <span>{f.regola1}</span>
                </div>
                <div className="effetto">
                  <Icona icona={Info} dimensione="s" />
                  <span>{f.regola2}</span>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
      {fonte && (
        <DialogoMotivazione
          aperto={vietata}
          onChiudi={() => setVietata(false)}
          titolo={f.vietataTitolo}
          sopratitolo={nomeFonte(fonte)}
          effetto={f.vietataEffetto}
          etichettaMotivazione={testi.comune.motivazione}
          aiutoMotivazione={testi.comune.restaNelRegistro}
          erroreMotivazioneMancante={testi.comune.motivazioneMancante}
          etichettaConferma={f.vietataAzione}
          etichettaAnnulla={testi.comune.annulla}
          variante="pericolo"
          testoErrore={testoErrore}
          onConferma={async (motivazione) => {
            await segnaFonteVietata(fonte.id, motivazione);
            await registraMotivazione('fonte', fonte.id, `Fonte vietata. ${motivazione}`);
            setVietata(false);
            await client.invalidateQueries({ queryKey: CHIAVI.tutto });
          }}
        />
      )}
    </>
  );
}

function RiepilogoConformita({ fonte }: { fonte: Fonte }) {
  return (
    <section className="md-sezione" aria-labelledby="riepilogo-conformita">
      <h2 id="riepilogo-conformita" className="etichetta-riga">
        {f.conformita}
      </h2>
      <div className="riga-dato">
        <span className="lbl">{f.robotsBreve}</span>
        <span>{fonte.robots_esito ? f.robotsOpzioni[fonte.robots_esito] : '—'}</span>
        {fonte.tipo === 'sito_locale' ? (
          <a
            className="link-in-testo"
            href={`https://${urlBreve(fonte.url).split('/')[0] ?? ''}/robots.txt`}
            target="_blank"
            rel="noreferrer"
          >
            {f.apri}
          </a>
        ) : (
          <span />
        )}
      </div>
      <div className="riga-dato">
        <span className="lbl">{f.terminiBreve}</span>
        <span className="t-mono-dato">
          {fonte.termini_letti_il ? f.letti(data(fonte.termini_letti_il)) : '—'}
        </span>
        {fonte.termini_url ? (
          <a className="link-in-testo" href={fonte.termini_url} target="_blank" rel="noreferrer">
            {f.apri}
          </a>
        ) : (
          <span />
        )}
      </div>
      <div className="riga-dato">
        <span className="lbl">{f.limiti}</span>
        <span className="t-mono-dato">
          {f.limitiValore(fonte.pagine_massime, testi.fonti.frequenza(fonte.frequenza_minuti))}
        </span>
        <span />
      </div>
    </section>
  );
}

function ElencoEsecuzioni({
  esecuzioni,
  caricamento,
}: {
  esecuzioni: Esecuzione[] | undefined;
  caricamento: boolean;
}) {
  const c = f.colonneEsecuzioni;
  const colonne: ReadonlyArray<ColonnaTabella<Esecuzione>> = [
    { chiave: 'durata', titolo: c.durata, cella: (e) => durata(e.durata_ms), classe: 'mono num' },
    { chiave: 'pagine', titolo: c.pagine, cella: (e) => e.pagine_lette, classe: 'mono num' },
    {
      chiave: 'eventi',
      titolo: c.eventi,
      cella: (e) => (
        <span className="esito">
          <span>
            <b>{e.eventi_letti}</b> {testi.fonti.esito.letti}
          </span>
          <span>
            <b>{e.eventi_nuovi}</b> {testi.fonti.esito.nuovi}
          </span>
          <span>
            <b>{e.eventi_uniti}</b> {testi.fonti.esito.uniti}
          </span>
        </span>
      ),
    },
    {
      chiave: 'errore',
      titolo: c.errore,
      cella: (e) =>
        e.codice_errore ? (
          <Badge variante="errore">{e.codice_errore}</Badge>
        ) : (
          <span className="trattino">—</span>
        ),
    },
  ];
  return (
    <section className="md-sezione" aria-labelledby="esecuzioni">
      <h2 id="esecuzioni" className="etichetta-riga">
        {f.esecuzioni}
      </h2>
      {caricamento && <Caricamento descrizione={f.caricamento} righe={3} />}
      {esecuzioni?.length === 0 && <p className="guida">{f.nessunaEsecuzione}</p>}
      {esecuzioni && esecuzioni.length > 0 && (
        <TabellaDensa
          etichetta={f.esecuzioni}
          titoloPrima={c.inizio}
          colonne={colonne}
          righe={esecuzioni}
          chiaveRiga={(e) => String(e.id)}
          prima={(e) => (
            <span className="t-mono-dato" title={e.messaggio_errore ?? undefined}>
              {dataOra(e.iniziata_il)} {e.prova && <Badge variante="testo">{f.prova}</Badge>}
            </span>
          )}
        />
      )}
    </section>
  );
}
