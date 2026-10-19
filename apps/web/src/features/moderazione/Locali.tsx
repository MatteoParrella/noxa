'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CircleCheck, Plus, Store } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { DialogoMotivazione } from '@/components/ui/DialogoMotivazione';
import { Icona } from '@/components/ui/Icona';
import { Pulsante } from '@/components/ui/Pulsante';
import { Caricamento, ElencoVuoto, ErroreConAzione } from '@/components/ui/Stati';
import { TabellaDensa, type ColonnaTabella } from '@/components/ui/TabellaDensa';
import { messaggi } from '@/lib/messaggi/it';
import { decidiCandidato, type Candidato, type LocaleElenco, type Provincia } from './api';
import { CHIAVI, useCandidati, useContatori, useFotoFirmate, useLocali } from './dati';
import { dataOra, testoErrore } from './formato';
import { PERCORSI_MODERAZIONE } from './GuscioModerazione';
import { Filtro, GruppoFiltri, Ricerca, Testata } from './Testata';

const testi = messaggi.moderazione;
const t = testi.locali;

type StatoLocale = 'attivo' | 'da_verificare' | 'non_attivo';

function statoLocale(locale: LocaleElenco): StatoLocale {
  if (!locale.attivo) return 'non_attivo';
  return locale.da_verificare ? 'da_verificare' : 'attivo';
}

export function BadgeStatoLocale({ stato }: { stato: StatoLocale }) {
  if (stato === 'attivo') return <Badge variante="successo">{testi.stati.attivo}</Badge>;
  if (stato === 'da_verificare') return <Badge variante="avviso">{testi.stati.daVerificare}</Badge>;
  return <Badge variante="testo">{testi.stati.nonAttivo}</Badge>;
}

/** Locali e candidati da verificare (design/F-40-moderazione-fonti, tavola 02). */
export function Locali() {
  const parametri = useSearchParams();
  const vista = parametri.get('vista') === 'candidati' ? 'candidati' : 'tutti';
  const contatori = useContatori();
  const locali = useLocali();
  const candidatiTotali = contatori.data?.candidati_locali;

  return (
    <>
      {vista === 'tutti' ? (
        <ElencoLocali conta={locali.data?.length} />
      ) : (
        <ElencoCandidati candidatiTotali={candidatiTotali} />
      )}
    </>
  );
}

function schede(vista: 'tutti' | 'candidati', candidati: number | undefined) {
  return [
    { href: PERCORSI_MODERAZIONE.locali, etichetta: t.schede.tutti, attiva: vista === 'tutti' },
    {
      href: PERCORSI_MODERAZIONE.candidati,
      etichetta: t.schede.candidati,
      attiva: vista === 'candidati',
      extra:
        candidati !== undefined ? <span className="t-mono-dato c-2">{candidati}</span> : undefined,
    },
  ];
}

function PulsanteNuovo() {
  return (
    <Link className="btn btn-principale" href={PERCORSI_MODERAZIONE.nuovoLocale}>
      <Icona icona={Plus} dimensione="s" />
      {t.nuovo}
    </Link>
  );
}

function ElencoLocali({ conta }: { conta: number | undefined }) {
  const router = useRouter();
  const locali = useLocali();
  const contatori = useContatori();
  const [testo, setTesto] = useState('');
  const [provincia, setProvincia] = useState<Provincia | null>(null);
  const [stati, setStati] = useState<StatoLocale[]>([]);
  const [senzaFoto, setSenzaFoto] = useState(false);
  const [senzaFontiAttive, setSenzaFontiAttive] = useState(false);

  const filtrati = useMemo(() => {
    const cerca = testo.trim().toLocaleLowerCase('it-IT');
    return (locali.data ?? []).filter(
      (locale) =>
        (!cerca || locale.nome.toLocaleLowerCase('it-IT').includes(cerca)) &&
        (!provincia || locale.provincia === provincia) &&
        (stati.length === 0 || stati.includes(statoLocale(locale))) &&
        (!senzaFoto || !locale.immagine_path) &&
        (!senzaFontiAttive || locale.fonti_attive === 0),
    );
  }, [locali.data, testo, provincia, stati, senzaFoto, senzaFontiAttive]);
  const percorsiFoto = useMemo(
    () => filtrati.flatMap((locale) => (locale.immagine_path ? [locale.immagine_path] : [])),
    [filtrati],
  );
  const foto = useFotoFirmate(percorsiFoto);

  const togliFiltri = () => {
    setTesto('');
    setProvincia(null);
    setStati([]);
    setSenzaFoto(false);
    setSenzaFontiAttive(false);
  };
  const alternaStato = (stato: StatoLocale) =>
    setStati((attuali) =>
      attuali.includes(stato) ? attuali.filter((s) => s !== stato) : [...attuali, stato],
    );

  const colonne: ReadonlyArray<ColonnaTabella<LocaleElenco>> = [
    { chiave: 'provincia', titolo: t.colonne.provincia, cella: (l) => l.provincia, classe: 'mono' },
    {
      chiave: 'stato',
      titolo: t.colonne.stato,
      cella: (l) => <BadgeStatoLocale stato={statoLocale(l)} />,
    },
    {
      chiave: 'foto',
      titolo: t.colonne.foto,
      cella: (l) => {
        const url = l.immagine_path ? foto.data?.[l.immagine_path] : undefined;
        if (!l.immagine_path) return <Badge variante="testo">{testi.comune.nessuna}</Badge>;
        return (
          <span className="mini-foto">
            {/* eslint-disable-next-line @next/next/no-img-element -- URL firmato temporaneo */}
            {url && <img src={url} alt="" />}
            {t.fotoSi}
          </span>
        );
      },
    },
    {
      chiave: 'fonti',
      titolo: t.colonne.fonti,
      cella: (l) => `${l.fonti_totali} / ${l.fonti_attive}`,
      classe: 'mono',
    },
    {
      chiave: 'eventi',
      titolo: t.colonne.eventi,
      cella: (l) => l.eventi_7_giorni,
      classe: 'mono num nasc-1024',
    },
    {
      chiave: 'aggiornato',
      titolo: t.colonne.aggiornato,
      cella: (l) => dataOra(l.aggiornato_il),
      classe: 'mono nasc-390',
    },
  ];

  return (
    <>
      <Testata
        titolo={t.titolo}
        conta={conta !== undefined ? t.conteggio(filtrati.length, conta) : undefined}
        strumenti={
          <>
            <Ricerca etichetta={t.cerca} valore={testo} onCambia={setTesto} />
            <PulsanteNuovo />
          </>
        }
        schede={schede('tutti', contatori.data?.candidati_locali)}
        etichettaSchede={t.titolo}
        filtri={
          <>
            <GruppoFiltri etichetta={t.filtri.provincia}>
              <Filtro attivo={provincia === null} onCambia={() => setProvincia(null)}>
                {testi.comune.tutte}
              </Filtro>
              {(['MI', 'MB'] as const).map((sigla) => (
                <Filtro
                  key={sigla}
                  attivo={provincia === sigla}
                  onCambia={() => setProvincia(sigla)}
                >
                  {sigla}
                </Filtro>
              ))}
            </GruppoFiltri>
            <GruppoFiltri etichetta={t.filtri.stato}>
              <Filtro attivo={stati.includes('attivo')} onCambia={() => alternaStato('attivo')}>
                {testi.stati.attivo}
              </Filtro>
              <Filtro
                attivo={stati.includes('da_verificare')}
                onCambia={() => alternaStato('da_verificare')}
              >
                {testi.stati.daVerificare}
              </Filtro>
              <Filtro
                attivo={stati.includes('non_attivo')}
                onCambia={() => alternaStato('non_attivo')}
              >
                {testi.stati.nonAttivo}
              </Filtro>
            </GruppoFiltri>
            <Filtro attivo={senzaFoto} onCambia={() => setSenzaFoto((v) => !v)}>
              {t.filtri.senzaFoto}
            </Filtro>
            <Filtro attivo={senzaFontiAttive} onCambia={() => setSenzaFontiAttive((v) => !v)}>
              {t.filtri.senzaFontiAttive}
            </Filtro>
          </>
        }
      />
      <div className="md-scorre">
        {locali.isPending && <Caricamento descrizione={t.caricamento} righe={6} />}
        {locali.isError && (
          <div className="pt-6">
            <ErroreConAzione
              titolo={testi.comune.erroreCaricamento.titolo}
              onRiprova={() => void locali.refetch()}
              riprovaInCorso={locali.isFetching}
            >
              {testi.comune.erroreCaricamento.testo}
            </ErroreConAzione>
          </div>
        )}
        {locali.data && filtrati.length === 0 && (
          <div className="pt-6">
            <ElencoVuoto
              icona={Store}
              titolo={t.vuoto.titolo}
              azione={
                <Pulsante variante="secondario" onClick={togliFiltri}>
                  {t.vuoto.azione}
                </Pulsante>
              }
            >
              {t.vuoto.testo}
            </ElencoVuoto>
          </div>
        )}
        {filtrati.length > 0 && (
          <>
            <TabellaDensa
              etichetta={t.titolo}
              titoloPrima={t.colonne.locale}
              colonne={colonne}
              righe={filtrati}
              chiaveRiga={(l) => l.id}
              onApri={(l) => router.push(PERCORSI_MODERAZIONE.locale(l.id))}
              prima={(l) => (
                <span className="cella-nome">
                  <Link href={PERCORSI_MODERAZIONE.locale(l.id)} data-apri-riga>
                    {l.nome}
                  </Link>
                  <span>{l.comune}</span>
                </span>
              )}
            />
            <p className="guida pt-3">{t.aiutoTabella}</p>
          </>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Candidati da verificare
// ---------------------------------------------------------------------------------------------

type Decisione = { tipo: 'unisci' | 'scarta'; candidato: Candidato };

function nomeCandidato(candidato: Candidato): string {
  return candidato.nome ?? messaggi.moderazione.candidati.googleSenzaDati;
}

function ElencoCandidati({ candidatiTotali }: { candidatiTotali: number | undefined }) {
  const c = testi.candidati;
  const candidati = useCandidati();
  const locali = useLocali();
  const client = useQueryClient();
  const [decisione, setDecisione] = useState<Decisione | null>(null);
  const [scelto, setScelto] = useState<string | null>(null);
  const [cercaLocale, setCercaLocale] = useState('');
  const [fatto, setFatto] = useState<string | null>(null);

  const decidi = useMutation({
    mutationFn: (dati: { esito: 'unito' | 'scartato'; motivazione: string }) =>
      decidiCandidato(
        (decisione as Decisione).candidato.id,
        dati.esito,
        dati.esito === 'unito' ? scelto : null,
        dati.motivazione,
      ),
    onSuccess: (_, dati) => {
      setFatto(dati.esito === 'unito' ? c.fatto.unito : c.fatto.scartato);
      setDecisione(null);
      setScelto(null);
      void client.invalidateQueries({ queryKey: CHIAVI.candidati });
      void client.invalidateQueries({ queryKey: CHIAVI.contatori });
      void client.invalidateQueries({ queryKey: CHIAVI.locali });
    },
  });

  const opzioniLocali = useMemo(() => {
    const cerca = cercaLocale.trim().toLocaleLowerCase('it-IT');
    return (locali.data ?? [])
      .filter((locale) => !cerca || locale.nome.toLocaleLowerCase('it-IT').includes(cerca))
      .slice(0, 8);
  }, [locali.data, cercaLocale]);

  const colonne: ReadonlyArray<ColonnaTabella<Candidato>> = [
    {
      chiave: 'origine',
      titolo: c.colonne.origine,
      cella: (k) => <Badge variante="testo">{c.origine[k.origine]}</Badge>,
    },
    {
      chiave: 'doppione',
      titolo: c.colonne.doppione,
      cella: (k) =>
        k.doppione_id ? (
          <Link href={PERCORSI_MODERAZIONE.locale(k.doppione_id)}>{k.doppione_nome}</Link>
        ) : (
          <span className="trattino">—</span>
        ),
    },
    {
      chiave: 'azioni',
      titolo: c.colonne.azioni,
      cella: (k) => (
        <span className="flex flex-wrap gap-2">
          <Link
            className="btn btn-secondario btn-s"
            href={`${PERCORSI_MODERAZIONE.nuovoLocale}?candidato=${k.id}`}
          >
            {c.verificaCrea}
          </Link>
          <Pulsante
            dimensione="s"
            variante="secondario"
            onClick={() => {
              setDecisione({ tipo: 'unisci', candidato: k });
              setScelto(k.doppione_id);
              setCercaLocale('');
            }}
          >
            {c.unisci}
          </Pulsante>
          <Pulsante
            dimensione="s"
            variante="testo"
            onClick={() => setDecisione({ tipo: 'scarta', candidato: k })}
          >
            {c.scarta}
          </Pulsante>
        </span>
      ),
    },
  ];

  return (
    <>
      <Testata
        titolo={t.titolo}
        conta={candidatiTotali !== undefined ? t.candidatiConteggio(candidatiTotali) : undefined}
        strumenti={<PulsanteNuovo />}
        schede={schede('candidati', candidatiTotali)}
        etichettaSchede={t.titolo}
      />
      <div className="md-scorre">
        <p className="guida pt-4">{c.spiegazione}</p>
        {fatto && (
          <div className="conferma-riga mt-3" role="status">
            <Icona icona={CircleCheck} dimensione="s" />
            {fatto}
          </div>
        )}
        {candidati.isPending && <Caricamento descrizione={c.caricamento} righe={4} />}
        {candidati.isError && (
          <div className="pt-6">
            <ErroreConAzione
              titolo={testi.comune.erroreCaricamento.titolo}
              onRiprova={() => void candidati.refetch()}
              riprovaInCorso={candidati.isFetching}
            >
              {testi.comune.erroreCaricamento.testo}
            </ErroreConAzione>
          </div>
        )}
        {candidati.data?.length === 0 && (
          <div className="pt-6">
            <ElencoVuoto icona={Store} titolo={c.vuoto.titolo}>
              {c.vuoto.testo}
            </ElencoVuoto>
          </div>
        )}
        {candidati.data && candidati.data.length > 0 && (
          <TabellaDensa
            etichetta={t.schede.candidati}
            titoloPrima={c.colonne.candidato}
            colonne={colonne}
            righe={candidati.data}
            chiaveRiga={(k) => k.id}
            prima={(k) => (
              <span className="cella-nome">
                <b>{nomeCandidato(k)}</b>
                {k.origine === 'osm' ? (
                  <span>{[k.indirizzo, k.comune].filter(Boolean).join(', ')}</span>
                ) : (
                  <a
                    href={`https://www.google.com/maps/place/?q=place_id:${k.google_place_id ?? ''}`}
                    target="_blank"
                    rel="noreferrer"
                    data-apri-riga
                  >
                    {c.apriGoogle}
                  </a>
                )}
              </span>
            )}
          />
        )}
      </div>

      <DialogoMotivazione
        aperto={decisione?.tipo === 'unisci'}
        onChiudi={() => setDecisione(null)}
        titolo={c.unisciTitolo}
        sopratitolo={decisione ? nomeCandidato(decisione.candidato) : undefined}
        effetto={c.unisciEffetto}
        etichettaMotivazione={testi.comune.motivazione}
        aiutoMotivazione={testi.comune.restaNelRegistro}
        erroreMotivazioneMancante={testi.comune.motivazioneMancante}
        etichettaConferma={c.unisciAzione}
        etichettaAnnulla={testi.comune.annulla}
        testoErrore={testoErrore}
        onConferma={(motivazione) => decidi.mutateAsync({ esito: 'unito', motivazione })}
      >
        <div className="flex flex-col gap-2">
          <Ricerca etichetta={c.unisciCerca} valore={cercaLocale} onCambia={setCercaLocale} />
          <fieldset className="m-0 flex flex-col border-0 p-0">
            <legend className="sr-only">{c.unisciCerca}</legend>
            {opzioniLocali.map((locale) => (
              <label key={locale.id} className="casella">
                <input
                  type="radio"
                  name="locale-unione"
                  checked={scelto === locale.id}
                  onChange={() => setScelto(locale.id)}
                />
                <span>
                  <b>{locale.nome}</b> · {locale.comune}
                </span>
              </label>
            ))}
          </fieldset>
        </div>
      </DialogoMotivazione>

      <DialogoMotivazione
        aperto={decisione?.tipo === 'scarta'}
        onChiudi={() => setDecisione(null)}
        titolo={decisione ? c.scartaTitolo(nomeCandidato(decisione.candidato)) : ''}
        effetto={c.scartaEffetto}
        etichettaMotivazione={testi.comune.motivazione}
        aiutoMotivazione={testi.comune.restaNelRegistro}
        erroreMotivazioneMancante={testi.comune.motivazioneMancante}
        etichettaConferma={c.scartaAzione}
        etichettaAnnulla={testi.comune.annulla}
        variante="pericolo"
        testoErrore={testoErrore}
        onConferma={(motivazione) => decidi.mutateAsync({ esito: 'scartato', motivazione })}
      />
    </>
  );
}
