'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, CircleAlert, Info, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Avviso } from '@/components/ui/Avviso';
import { Campo } from '@/components/ui/Campo';
import { DialogoMotivazione } from '@/components/ui/DialogoMotivazione';
import { Icona } from '@/components/ui/Icona';
import { MenuAzioni } from '@/components/ui/MenuAzioni';
import { Pulsante } from '@/components/ui/Pulsante';
import { Selezione } from '@/components/ui/Selezione';
import { Caricamento, ErroreConAzione } from '@/components/ui/Stati';
import { useToast } from '@/components/ui/Toast';
import { messaggi } from '@/lib/messaggi/it';
import {
  decidiFlyer,
  escalationFlyer,
  type Estrazione,
  type EventoJson,
  type FlyerCoda,
  type LocaleElenco,
} from './api';
import { CHIAVI, useCodaFlyer, useFirme, useGeneri, useLocali } from './dati';
import { Confidenza, SOGLIA_CONFIDENZA_BASSA } from './Flyer';
import { daCampoDataOra, dataOra, perCampoDataOra, prezzo, testoErrore } from './formato';
import { PERCORSI_MODERAZIONE } from './GuscioModerazione';
import { AnteprimaMessaggio, DialogoEscalation } from './Riservato';
import { Filtro } from './Testata';
import { VisualizzatoreFlyer } from './VisualizzatoreFlyer';

const testi = messaggi.moderazione;
const r = testi.revisioneFlyer;
const esiti = messaggi.notifiche.esiti;
const ETA = [14, 15, 16, 17, 18, 19, 20, 21, 23, 25] as const;
const NON_DICHIARATA = 'non_dichiarata';

type Modulo = {
  titolo: string;
  locale_id: string;
  inizio: string;
  fine: string;
  eta: string;
  alcol: boolean | null;
  generi: string[];
  artisti: string;
  prezzo: string;
  url_biglietti: string;
  confrontato: boolean;
  adatto: boolean;
  motivazioneEta: string;
};

type CampoErrore =
  | 'titolo'
  | 'locale_id'
  | 'inizio'
  | 'fine'
  | 'prezzo'
  | 'url_biglietti'
  | 'alcol'
  | 'conferme'
  | 'motivazioneEta';
type Errori = Partial<Record<CampoErrore, string>>;

type Dialogo = 'rifiuta' | 'unisci' | 'escalation' | null;

/** Codice breve del flyer per le briciole: le prime cifre dell'identificativo. */
function codice(id: string): string {
  return `FLY-${id.slice(0, 4).toUpperCase()}`;
}

function normalizza(testo: string): string {
  return testo.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('it-IT').trim();
}

/** Locale letto dal modello, se il nome corrisponde a uno solo dei locali censiti. */
function localeDaNome(nome: string | null | undefined, locali: LocaleElenco[]): string {
  if (!nome) return '';
  const cercato = normalizza(nome);
  const trovati = locali.filter((l) => {
    const n = normalizza(l.nome);
    return n === cercato || n.includes(cercato) || cercato.includes(n);
  });
  return trovati.length === 1 ? (trovati[0] as LocaleElenco).id : '';
}

/** Data e ora locali dell'estrazione nel formato dei campi `datetime-local`. */
function campoDa(data: string | null | undefined, ora: string | null | undefined): string {
  if (!data || !ora) return '';
  return `${data}T${ora.slice(0, 5)}`;
}

function fineDa(estrazione: Estrazione): string {
  const { data, ora_inizio: inizio, ora_fine: fine } = estrazione;
  if (!data || !fine) return '';
  // Una fine prima dell'inizio è dopo mezzanotte.
  if (inizio && fine.slice(0, 5) <= inizio.slice(0, 5)) {
    const giorno = new Date(`${data}T12:00:00Z`);
    giorno.setUTCDate(giorno.getUTCDate() + 1);
    return campoDa(giorno.toISOString().slice(0, 10), fine);
  }
  return campoDa(data, fine);
}

function moduloDa(
  evento: EventoJson | null,
  estrazione: Estrazione | null,
  locali: LocaleElenco[],
): Modulo {
  const x = estrazione ?? {};
  const centesimi = evento?.prezzo_min_centesimi ?? x.prezzo_min_centesimi ?? null;
  const etaLetta = x.eta_minima ?? null;
  return {
    titolo: evento?.titolo ?? x.titolo ?? '',
    locale_id: evento?.locale_id ?? localeDaNome(x.nome_locale, locali),
    inizio: evento ? perCampoDataOra(evento.inizio) : campoDa(x.data, x.ora_inizio),
    fine: evento ? perCampoDataOra(evento.fine) : fineDa(x),
    eta: evento
      ? evento.eta_minima_dichiarata
        ? String(evento.eta_minima)
        : NON_DICHIARATA
      : etaLetta !== null
        ? String(etaLetta)
        : NON_DICHIARATA,
    // R-23: la scelta sull'alcol la fa sempre il moderatore.
    alcol: null,
    generi: evento?.generi ?? x.generi ?? [],
    artisti: (evento?.artisti ?? x.artisti ?? []).join(', '),
    prezzo:
      centesimi === null
        ? ''
        : (centesimi / 100).toLocaleString('it-IT', { maximumFractionDigits: 2 }),
    url_biglietti: evento?.url_biglietti ?? '',
    confrontato: false,
    adatto: false,
    motivazioneEta: '',
  };
}

function etaDi(modulo: Modulo): number {
  return modulo.eta === NON_DICHIARATA ? 18 : Number(modulo.eta);
}

function valida(modulo: Modulo): Errori {
  const e = r.errori;
  const errori: Errori = {};
  if (!modulo.titolo.trim() || modulo.titolo.trim().length > 200) errori.titolo = e.titolo;
  if (!modulo.locale_id) errori.locale_id = e.locale;
  const inizio = daCampoDataOra(modulo.inizio);
  if (!inizio) errori.inizio = e.inizio;
  if (modulo.fine) {
    const fine = daCampoDataOra(modulo.fine);
    const durata = fine && inizio ? new Date(fine).getTime() - new Date(inizio).getTime() : -1;
    if (durata <= 0 || durata > 24 * 3600_000) errori.fine = e.fine;
  }
  if (modulo.prezzo.trim() && !/^\d{1,4}([.,]\d{1,2})?$/.test(modulo.prezzo.trim())) {
    errori.prezzo = e.prezzo;
  }
  if (modulo.url_biglietti.trim() && !/^https:\/\/\S+$/.test(modulo.url_biglietti.trim())) {
    errori.url_biglietti = e.biglietti;
  }
  if (modulo.alcol === null) errori.alcol = e.alcol;
  if (!modulo.confrontato || !modulo.adatto) errori.conferme = e.conferme;
  if (etaDi(modulo) < 18 && !modulo.motivazioneEta.trim()) errori.motivazioneEta = e.motivazioneEta;
  return errori;
}

/** Revisione di un flyer (tavola 12): flyer a sinistra, campi estratti a destra (R-51). */
export function RevisioneFlyer({ id }: { id: string }) {
  const coda = useCodaFlyer();
  const locali = useLocali();

  if (coda.isPending || locali.isPending) {
    return <Caricamento descrizione={r.caricamento} righe={8} />;
  }
  if (coda.isError || locali.isError) {
    return (
      <div className="md-scorre pt-6">
        <ErroreConAzione
          titolo={testi.comune.erroreCaricamento.titolo}
          onRiprova={() => {
            void coda.refetch();
            void locali.refetch();
          }}
          riprovaInCorso={coda.isFetching || locali.isFetching}
        >
          {testi.comune.erroreCaricamento.testo}
        </ErroreConAzione>
      </div>
    );
  }
  const indice = coda.data.findIndex((f) => f.id === id);
  const flyer = coda.data[indice];
  if (!flyer) {
    const primo = coda.data[0];
    return (
      <>
        <Testata titolo={r.titolo} id={id} />
        <div className="md-scorre pt-6">
          <Avviso tipo="info" titolo={r.giaDeciso.titolo}>
            <p className="m-0">{r.giaDeciso.testo}</p>
            <p className="m-0 mt-2">
              <Link
                className="btn btn-secondario btn-s"
                href={
                  primo ? PERCORSI_MODERAZIONE.revisioneFlyer(primo.id) : PERCORSI_MODERAZIONE.flyer
                }
              >
                {primo ? r.giaDeciso.successivo : r.giaDeciso.coda}
              </Link>
            </p>
          </Avviso>
        </div>
      </>
    );
  }
  return (
    <Revisione
      flyer={flyer}
      locali={locali.data}
      precedente={coda.data[indice - 1]?.id ?? null}
      successivo={coda.data[indice + 1]?.id ?? null}
      posizione={indice + 1}
      totale={coda.data.length}
    />
  );
}

function Testata({ titolo, id, children }: { titolo: string; id: string; children?: ReactNode }) {
  return (
    <header className="md-testa">
      <nav className="briciole" aria-label={testi.codaFlyer.titolo}>
        <Link href={PERCORSI_MODERAZIONE.flyer}>{testi.codaFlyer.titolo}</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page" className="mono">
          {codice(id)}
        </span>
      </nav>
      <div className="md-titolo-riga">
        <h1 className="md-titolo">{titolo}</h1>
        {children && <div className="md-strumenti">{children}</div>}
      </div>
    </header>
  );
}

function Revisione({
  flyer,
  locali,
  precedente,
  successivo,
  posizione,
  totale,
}: {
  flyer: FlyerCoda;
  locali: LocaleElenco[];
  precedente: string | null;
  successivo: string | null;
  posizione: number;
  totale: number;
}) {
  const router = useRouter();
  const client = useQueryClient();
  const mostraToast = useToast();
  const generi = useGeneri();
  const firme = useFirme('flyer-caricati', [flyer.storage_path]);
  const idForm = useId();
  const form = useRef<HTMLFormElement>(null);
  const estrazione = flyer.risultato_estrazione;
  const [modulo, setModulo] = useState<Modulo>(() => moduloDa(flyer.evento, estrazione, locali));
  const [errori, setErrori] = useState<Errori>({});
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [motivoRifiuto, setMotivoRifiuto] = useState<string>('illeggibile');

  const cambia = <K extends keyof Modulo>(chiave: K, valore: Modulo[K]) =>
    setModulo((attuale) => ({ ...attuale, [chiave]: valore }));

  // Dopo una decisione si passa al flyer successivo, come chiede la tavola "Decisione salvata".
  const dopo = async (testo: string) => {
    setDialogo(null);
    await client.invalidateQueries({ queryKey: CHIAVI.codaFlyer });
    void client.invalidateQueries({ queryKey: CHIAVI.contatori });
    const prossimo = successivo ?? precedente;
    mostraToast({ testo: `${testo} ${prossimo ? r.fatto.successivo : r.fatto.finiti}` });
    router.replace(
      prossimo ? PERCORSI_MODERAZIONE.revisioneFlyer(prossimo) : PERCORSI_MODERAZIONE.flyer,
    );
  };

  const approvazione = useMutation({
    mutationFn: () => {
      const eta = etaDi(modulo);
      return decidiFlyer(flyer.id, 'approva', {
        dati: {
          titolo: modulo.titolo.trim(),
          locale_id: modulo.locale_id,
          inizio: daCampoDataOra(modulo.inizio),
          fine: modulo.fine ? daCampoDataOra(modulo.fine) : null,
          eta_minima: modulo.eta === NON_DICHIARATA ? null : eta,
          eta_minima_dichiarata: modulo.eta !== NON_DICHIARATA,
          riferimenti_alcol: modulo.alcol,
          generi: modulo.generi,
          artisti: modulo.artisti
            .split(',')
            .map((a) => a.trim())
            .filter(Boolean),
          prezzo_min_centesimi: modulo.prezzo.trim()
            ? Math.round(Number(modulo.prezzo.trim().replace(',', '.')) * 100)
            : null,
          url_biglietti: modulo.url_biglietti.trim() || null,
          confrontato: modulo.confrontato,
          immagine_adatta: modulo.adatto,
          // ADR-0018: il flyer diventa copertina solo se adatto e non sospetto.
          pubblica_immagine: modulo.adatto && !flyer.contenuto_sospetto,
        },
        ...(eta < 18 ? { motivazione: modulo.motivazioneEta.trim() } : {}),
      });
    },
    onSuccess: () => void dopo(r.fatto.approvato(modulo.titolo.trim())),
  });

  function approva(evento?: FormEvent) {
    evento?.preventDefault();
    const trovati = valida(modulo);
    setErrori(trovati);
    if (Object.keys(trovati).length === 0) approvazione.mutate();
  }

  // Scorciatoie (tavola 12): A approva, R rifiuta, frecce per il flyer vicino.
  useEffect(() => {
    function tasto(evento: KeyboardEvent) {
      if (dialogo || evento.metaKey || evento.ctrlKey || evento.altKey) return;
      const bersaglio = evento.target as HTMLElement | null;
      if (bersaglio?.closest('input, textarea, select, [contenteditable], dialog, .vista-tela')) {
        return;
      }
      const tasto = evento.key.toLowerCase();
      if (tasto === 'a') form.current?.requestSubmit();
      else if (tasto === 'r') setDialogo('rifiuta');
      else if (evento.key === 'ArrowLeft' && precedente) {
        router.push(PERCORSI_MODERAZIONE.revisioneFlyer(precedente));
      } else if (evento.key === 'ArrowRight' && successivo) {
        router.push(PERCORSI_MODERAZIONE.revisioneFlyer(successivo));
      } else return;
      evento.preventDefault();
    }
    window.addEventListener('keydown', tasto);
    return () => window.removeEventListener('keydown', tasto);
  }, [dialogo, precedente, successivo, router]);

  const confidenze = estrazione?.confidenza ?? {};
  const segno = (valore: number | undefined) =>
    valore !== undefined && valore < SOGLIA_CONFIDENZA_BASSA
      ? r.daControllare(Math.round(valore * 100))
      : undefined;
  const segnoTitolo = segno(confidenze.titolo);
  const segnoLocale = segno(confidenze.nome_locale);
  const confInizio = Math.min(confidenze.data ?? 1, confidenze.ora_inizio ?? 1);
  const segnoInizio = segno(confInizio < 1 ? confInizio : undefined);
  const segnoEta = segno(confidenze.eta_minima);
  const eta = etaDi(modulo);
  const motivoScelto = r.rifiuto.motivi.find((m) => m.valore === motivoRifiuto);
  const testoRifiuto = (scritto: string) =>
    [motivoScelto?.testo ?? '', scritto].filter(Boolean).join(' ');
  const opzioniEta = [
    { valore: NON_DICHIARATA, etichetta: r.nonDichiarata },
    ...[...new Set([...ETA, ...(estrazione?.eta_minima ? [estrazione.eta_minima] : [])])]
      .sort((a, b) => a - b)
      .map((n) => ({ valore: String(n), etichetta: `${n}+` })),
  ];

  return (
    <>
      <Testata titolo={r.titolo} id={flyer.id}>
        <span className="conta mono" aria-label={r.posizione(posizione, totale)}>
          {r.posizione(posizione, totale)}
        </span>
        <Pulsante
          variante="neutro"
          soloIcona
          aria-label={r.precedente}
          disabled={!precedente}
          onClick={() => precedente && router.push(PERCORSI_MODERAZIONE.revisioneFlyer(precedente))}
        >
          <Icona icona={ChevronLeft} dimensione="s" />
        </Pulsante>
        <Pulsante
          variante="neutro"
          soloIcona
          aria-label={r.successivo}
          disabled={!successivo}
          onClick={() => successivo && router.push(PERCORSI_MODERAZIONE.revisioneFlyer(successivo))}
        >
          <Icona icona={ChevronRight} dimensione="s" />
        </Pulsante>
        <Pulsante variante="secondario" aria-keyshortcuts="R" onClick={() => setDialogo('rifiuta')}>
          {r.rifiuta}
        </Pulsante>
        {flyer.candidato && (
          <Pulsante variante="secondario" onClick={() => setDialogo('unisci')}>
            {r.unisci}
          </Pulsante>
        )}
        <Pulsante
          type="submit"
          form={idForm}
          variante="principale"
          aria-keyshortcuts="A"
          caricamento={approvazione.isPending}
        >
          {r.approva}
        </Pulsante>
        <MenuAzioni
          etichetta={r.altreAzioni}
          voci={[
            {
              etichetta: testi.escalation.voce,
              icona: <Icona icona={ShieldAlert} dimensione="s" />,
              pericolo: true,
              onScegli: () => setDialogo('escalation'),
            },
          ]}
        />
      </Testata>
      <div className="md-scorre">
        <p className="guida m-0 pt-3">{r.scorciatoie}</p>
        <div className="rev-due">
          <VisualizzatoreFlyer
            url={firme.data?.[flyer.storage_path] ?? null}
            sospetto={flyer.contenuto_sospetto}
          />
          <form
            id={idForm}
            ref={form}
            className="md-col"
            onSubmit={approva}
            noValidate
            aria-label={r.titolo}
          >
            {approvazione.isError && (
              <Avviso tipo="errore" titolo={testi.comune.erroreSalvataggio.titolo} portaInVista>
                {testoErrore(approvazione.error)}
              </Avviso>
            )}
            {flyer.contenuto_sospetto && (
              <Avviso tipo="errore" titolo={r.sospetto.titolo}>
                {r.sospetto.testo}
              </Avviso>
            )}
            {flyer.stato === 'errore' && (
              <Avviso tipo="avviso" titolo={r.nonLeggibile.titolo}>
                {flyer.nota_revisione ?? r.nonLeggibile.testo}
              </Avviso>
            )}
            {flyer.candidato && (
              <Corrispondenza
                candidato={flyer.candidato}
                modulo={modulo}
                locali={locali}
                confidenza={flyer.confidenza}
                onUnisci={() => setDialogo('unisci')}
              />
            )}

            <section className="md-sezione" aria-labelledby={`${idForm}-dati`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id={`${idForm}-dati`} className="etichetta-riga flex-1">
                  {r.dati}
                </h2>
                <Confidenza valore={flyer.confidenza} />
              </div>
              <div className="campi2">
                <Campo
                  etichetta={r.titoloCampo}
                  value={modulo.titolo}
                  maxLength={200}
                  className={segnoTitolo ? 'campo-basso' : undefined}
                  aiuto={segnoTitolo}
                  errore={errori.titolo}
                  onChange={(e) => cambia('titolo', e.target.value)}
                />
                <div className={segnoLocale ? 'campo-basso' : undefined}>
                  <Selezione
                    etichetta={r.locale}
                    valore={modulo.locale_id}
                    segnaposto={r.localeScegli}
                    opzioni={locali.map((l) => ({
                      valore: l.id,
                      etichetta: `${l.nome} · ${l.comune}`,
                    }))}
                    aiuto={
                      [
                        estrazione?.nome_locale ? r.localeLetto(estrazione.nome_locale) : null,
                        segnoLocale ?? null,
                      ]
                        .filter(Boolean)
                        .join(' · ') || undefined
                    }
                    errore={errori.locale_id}
                    onCambia={(valore) => cambia('locale_id', valore)}
                  />
                  <Link className="btn btn-testo btn-s" href={PERCORSI_MODERAZIONE.nuovoLocale}>
                    {r.creaLocale}
                  </Link>
                </div>
                <Campo
                  etichetta={r.inizio}
                  type="datetime-local"
                  value={modulo.inizio}
                  className={segnoInizio ? 'campo-basso' : undefined}
                  aiuto={
                    [segnoInizio, estrazione?.anno_inferito ? r.annoInferito : undefined]
                      .filter(Boolean)
                      .join(' · ') || undefined
                  }
                  errore={errori.inizio}
                  onChange={(e) => cambia('inizio', e.target.value)}
                />
                <Campo
                  etichetta={r.fine}
                  type="datetime-local"
                  value={modulo.fine}
                  facoltativo
                  errore={errori.fine}
                  onChange={(e) => cambia('fine', e.target.value)}
                />
                <Campo
                  etichetta={r.artisti}
                  value={modulo.artisti}
                  aiuto={r.artistiAiuto}
                  facoltativo
                  onChange={(e) => cambia('artisti', e.target.value)}
                />
                <Campo
                  etichetta={r.prezzo}
                  inputMode="decimal"
                  value={modulo.prezzo}
                  facoltativo
                  errore={errori.prezzo}
                  onChange={(e) => cambia('prezzo', e.target.value)}
                />
                <Campo
                  etichetta={r.biglietti}
                  type="url"
                  value={modulo.url_biglietti}
                  placeholder="https://"
                  facoltativo
                  errore={errori.url_biglietti}
                  onChange={(e) => cambia('url_biglietti', e.target.value)}
                />
              </div>
              <div className="md-filtri" role="group" aria-label={r.generi}>
                <span className="etichetta" aria-hidden="true">
                  {r.generi}
                </span>
                {(generi.data ?? []).map((genere) => (
                  <Filtro
                    key={genere.codice}
                    attivo={modulo.generi.includes(genere.codice)}
                    onCambia={() =>
                      cambia(
                        'generi',
                        modulo.generi.includes(genere.codice)
                          ? modulo.generi.filter((g) => g !== genere.codice)
                          : [...modulo.generi, genere.codice].slice(0, 5),
                      )
                    }
                  >
                    {genere.nome}
                  </Filtro>
                ))}
              </div>
            </section>

            <section className="md-sezione" aria-labelledby={`${idForm}-eta`}>
              <h2 id={`${idForm}-eta`} className="etichetta-riga">
                {r.etaAlcol}
              </h2>
              <div className={segnoEta ? 'campo-basso' : undefined}>
                <Selezione
                  etichetta={r.etaMinima}
                  valore={modulo.eta}
                  opzioni={opzioniEta}
                  aiuto={
                    [modulo.eta === NON_DICHIARATA ? r.etaAiuto : null, segnoEta ?? null]
                      .filter(Boolean)
                      .join(' · ') || undefined
                  }
                  onCambia={(valore) => cambia('eta', valore)}
                />
              </div>
              {eta < 18 && (
                <div className="motivazione">
                  <Avviso tipo="avviso">{r.sottoDiciotto(eta)}</Avviso>
                  <label className="campo-etichetta" htmlFor={`${idForm}-motivazione-eta`}>
                    {r.motivazioneEta}
                  </label>
                  <textarea
                    id={`${idForm}-motivazione-eta`}
                    value={modulo.motivazioneEta}
                    maxLength={500}
                    aria-invalid={errori.motivazioneEta ? true : undefined}
                    aria-describedby={
                      errori.motivazioneEta ? `${idForm}-motivazione-eta-errore` : undefined
                    }
                    onChange={(e) => cambia('motivazioneEta', e.target.value)}
                  />
                  {errori.motivazioneEta && (
                    <span className="campo-errore" id={`${idForm}-motivazione-eta-errore`}>
                      {errori.motivazioneEta}
                    </span>
                  )}
                </div>
              )}
              <fieldset
                className="scelte-radio"
                aria-describedby={`${idForm}-alcol-aiuto${errori.alcol ? ` ${idForm}-alcol-errore` : ''}`}
              >
                <legend className="campo-etichetta">{r.alcol}</legend>
                <div className="scelta-due">
                  {([true, false] as const).map((valore) => (
                    <label key={String(valore)}>
                      <input
                        type="radio"
                        name={`${idForm}-alcol`}
                        checked={modulo.alcol === valore}
                        onChange={() => cambia('alcol', valore)}
                      />
                      {valore ? testi.comune.si : testi.comune.no}
                    </label>
                  ))}
                </div>
                <span className="guida" id={`${idForm}-alcol-aiuto`}>
                  {r.alcolAiuto}
                  {estrazione?.riferimenti_alcol !== undefined &&
                    ` ${r.alcolLetto(estrazione.riferimenti_alcol)}`}
                </span>
                {errori.alcol && (
                  <span className="campo-errore" id={`${idForm}-alcol-errore`}>
                    <Icona icona={CircleAlert} dimensione="s" />
                    {errori.alcol}
                  </span>
                )}
              </fieldset>
            </section>

            <section className="md-sezione" aria-labelledby={`${idForm}-prima`}>
              <h2 id={`${idForm}-prima`} className="etichetta-riga">
                {r.primaDiPubblicare}
              </h2>
              <label className="scelta-riga">
                <input
                  type="checkbox"
                  checked={modulo.confrontato}
                  onChange={(e) => cambia('confrontato', e.target.checked)}
                />
                <span>{r.confrontato}</span>
              </label>
              <label className="scelta-riga">
                <input
                  type="checkbox"
                  checked={modulo.adatto}
                  aria-describedby={`${idForm}-adatto-aiuto`}
                  onChange={(e) => cambia('adatto', e.target.checked)}
                />
                <span>
                  {r.adatto}
                  <span className="guida block" id={`${idForm}-adatto-aiuto`}>
                    {r.adattoAiuto}
                  </span>
                </span>
              </label>
              {errori.conferme && (
                <span className="campo-errore" role="alert">
                  <Icona icona={CircleAlert} dimensione="s" />
                  {errori.conferme}
                </span>
              )}
            </section>
            <p className="guida flex items-center gap-2 m-0 pb-6">
              <Icona icona={Info} dimensione="s" />
              {testi.codaFlyer.riservato} {dataOra(flyer.creato_il)}
            </p>
          </form>
        </div>
      </div>

      <DialogoMotivazione
        aperto={dialogo === 'rifiuta'}
        onChiudi={() => setDialogo(null)}
        titolo={r.rifiuto.titolo}
        sopratitolo={`${codice(flyer.id)}`}
        effetto={r.rifiuto.effetto}
        etichettaMotivazione={
          motivoRifiuto === 'altro' ? testi.comune.motivazione : testi.comune.motivazioneFacoltativa
        }
        aiutoMotivazione={r.rifiuto.aiuto}
        erroreMotivazioneMancante={testi.comune.motivazioneMancante}
        obbligatoria={motivoRifiuto === 'altro'}
        etichettaConferma={r.rifiuto.conferma}
        etichettaAnnulla={testi.comune.annulla}
        variante="pericolo"
        testoErrore={testoErrore}
        anteprima={(scritto) => (
          <AnteprimaMessaggio
            destinatario={testi.dettaglioSegnalazione.anteprima.coinvolto}
            titolo={esiti.flyer_rifiutato ?? ''}
            motivazione={testoRifiuto(scritto)}
          />
        )}
        onConferma={async (scritto) => {
          await decidiFlyer(flyer.id, 'rifiuta', { motivazione: testoRifiuto(scritto) });
          await dopo(r.fatto.rifiutato);
        }}
      >
        <fieldset className="scelte-radio">
          <legend className="campo-etichetta">{r.rifiuto.motivo}</legend>
          {r.rifiuto.motivi.map((motivo) => (
            <label key={motivo.valore}>
              <input
                type="radio"
                name={`${idForm}-motivo`}
                checked={motivoRifiuto === motivo.valore}
                onChange={() => setMotivoRifiuto(motivo.valore)}
              />
              {motivo.etichetta}
            </label>
          ))}
        </fieldset>
      </DialogoMotivazione>

      {flyer.candidato && (
        <DialogoMotivazione
          aperto={dialogo === 'unisci'}
          onChiudi={() => setDialogo(null)}
          titolo={r.unione.titolo}
          effetto={r.unione.effetto(flyer.candidato.titolo)}
          etichettaMotivazione={testi.comune.motivazioneFacoltativa}
          aiutoMotivazione={testi.comune.restaNelRegistro}
          erroreMotivazioneMancante={testi.comune.motivazioneMancante}
          obbligatoria={false}
          etichettaConferma={r.unione.conferma}
          etichettaAnnulla={testi.comune.annulla}
          testoErrore={testoErrore}
          onConferma={async (scritto) => {
            await decidiFlyer(flyer.id, 'unisci', {
              eventoEsistente: (flyer.candidato as EventoJson).id,
              ...(scritto ? { motivazione: scritto } : {}),
            });
            await dopo(r.fatto.unito);
          }}
        />
      )}

      <DialogoEscalation
        aperto={dialogo === 'escalation'}
        onChiudi={() => setDialogo(null)}
        sopratitolo={`${codice(flyer.id)} · R-55`}
        onConferma={async (motivazione) => {
          await escalationFlyer(flyer.id, motivazione);
          await dopo(r.fatto.escalation);
        }}
      />
    </>
  );
}

/** Confronto breve con l'evento già pubblicato e azione "Unisci" (R-51). */
function Corrispondenza({
  candidato,
  modulo,
  locali,
  confidenza,
  onUnisci,
}: {
  candidato: EventoJson;
  modulo: Modulo;
  locali: LocaleElenco[];
  confidenza: number | null;
  onUnisci: () => void;
}) {
  const c = r.corrispondenza;
  const localeFlyer = locali.find((l) => l.id === modulo.locale_id)?.nome ?? '—';
  const inizioFlyer = modulo.inizio ? dataOra(daCampoDataOra(modulo.inizio) ?? '') : '—';
  const righe: Array<[string, string, string]> = [
    [r.titoloCampo, modulo.titolo || '—', candidato.titolo],
    [r.locale, localeFlyer, candidato.locale_nome],
    [r.inizio, inizioFlyer, dataOra(candidato.inizio)],
    [r.prezzo, modulo.prezzo ? `${modulo.prezzo} €` : '—', prezzo(candidato.prezzo_min_centesimi)],
  ];
  return (
    <section className="corrisp" aria-label={c.titolo('')}>
      <p className="m-0 flex flex-wrap items-baseline gap-2">
        <span className="badge badge-info">
          {c.titolo(confidenza !== null ? `${Math.round(confidenza * 100)} %` : '')}
        </span>
        <b>{c.gia(candidato.titolo)}</b>
      </p>
      <table className="corrisp-tab">
        <thead>
          <tr>
            <th scope="col">{c.campo}</th>
            <th scope="col">{c.flyer}</th>
            <th scope="col">{c.pubblicato}</th>
          </tr>
        </thead>
        <tbody>
          {righe.map(([etichetta, daFlyer, pubblicato]) => (
            <tr key={etichetta}>
              <th scope="row">{etichetta}</th>
              <td className={normalizza(daFlyer) !== normalizza(pubblicato) ? 'diff' : undefined}>
                {daFlyer}
              </td>
              <td>{pubblicato}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="guida m-0">{c.nota}</p>
      <div>
        <Pulsante variante="secondario" dimensione="s" onClick={onUnisci}>
          {c.unisci}
        </Pulsante>
      </div>
    </section>
  );
}
