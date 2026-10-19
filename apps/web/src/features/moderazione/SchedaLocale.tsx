'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleCheck, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Avviso } from '@/components/ui/Avviso';
import { Badge } from '@/components/ui/Badge';
import { Campo } from '@/components/ui/Campo';
import { DialogoMotivazione } from '@/components/ui/DialogoMotivazione';
import { Icona } from '@/components/ui/Icona';
import { MappaPosizione, dentroLimiti } from '@/components/ui/MappaPosizione';
import { Pulsante } from '@/components/ui/Pulsante';
import { Selezione } from '@/components/ui/Selezione';
import { Caricamento, ErroreConAzione } from '@/components/ui/Stati';
import { CENTRO } from '@/lib/mappa/maplibre';
import { messaggi } from '@/lib/messaggi/it';
import {
  decidiCandidato,
  leggiEventi,
  registraMotivazione,
  salvaLocale,
  type DatiLocale,
  type Locale,
  type Provincia,
} from './api';
import { CHIAVI, useCandidati, useFontiLocale, useLocale } from './dati';
import { BadgeConformita, BadgeAttiva } from './Fonti';
import { etichettaEta, serata, testoErrore, urlBreve } from './formato';
import { FotoLocale } from './FotoLocale';
import { PERCORSI_MODERAZIONE } from './GuscioModerazione';
import { RegistroOggetto } from './RegistroOggetto';
import { Testata } from './Testata';

const testi = messaggi.moderazione;
const s = testi.scheda;

type Modulo = {
  nome: string;
  indirizzo: string;
  comune: string;
  provincia: Provincia;
  lat: string;
  lon: string;
  sito_web: string;
  instagram_username: string;
  attivo: boolean;
};

type Errori = Partial<
  Record<'nome' | 'indirizzo' | 'comune' | 'sito_web' | 'instagram_username' | 'coordinate', string>
>;

function moduloDa(locale: Locale | null): Modulo {
  return {
    nome: locale?.nome ?? '',
    indirizzo: locale?.indirizzo ?? '',
    comune: locale?.comune ?? '',
    provincia: locale?.provincia ?? 'MI',
    lat: String(locale?.lat ?? CENTRO[1]),
    lon: String(locale?.lon ?? CENTRO[0]),
    sito_web: locale?.sito_web ?? '',
    instagram_username: locale?.instagram_username ?? '',
    attivo: locale?.attivo ?? true,
  };
}

function valida(modulo: Modulo): Errori {
  const errori: Errori = {};
  if (!modulo.nome.trim() || modulo.nome.trim().length > 120) errori.nome = s.errori.nome;
  if (!modulo.indirizzo.trim()) errori.indirizzo = s.errori.indirizzo;
  if (!modulo.comune.trim()) errori.comune = s.errori.comune;
  if (modulo.sito_web.trim() && !/^https?:\/\/\S+$/.test(modulo.sito_web.trim())) {
    errori.sito_web = s.errori.sito;
  }
  if (
    modulo.instagram_username.trim() &&
    !/^@?[A-Za-z0-9_.]{1,30}$/.test(modulo.instagram_username.trim())
  ) {
    errori.instagram_username = s.errori.instagram;
  }
  const lat = Number(modulo.lat);
  const lon = Number(modulo.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !dentroLimiti(lat, lon)) {
    errori.coordinate = s.errori.coordinate;
  }
  return errori;
}

/** Scheda del locale (design/F-40-moderazione-fonti, tavola 03), anche per un nuovo locale. */
export function SchedaLocale() {
  const parametri = useSearchParams();
  const id = parametri.get('id');
  const candidatoId = parametri.get('candidato');
  const locale = useLocale(id);
  const candidati = useCandidati();

  if (id && locale.isPending) return <Caricamento descrizione={s.caricamento} righe={6} />;
  if (id && locale.isError) {
    return (
      <div className="md-scorre pt-6">
        <ErroreConAzione
          titolo={testi.comune.erroreCaricamento.titolo}
          onRiprova={() => void locale.refetch()}
          riprovaInCorso={locale.isFetching}
        >
          {testi.comune.erroreCaricamento.testo}
        </ErroreConAzione>
      </div>
    );
  }
  if (id && !locale.data) {
    return (
      <div className="md-scorre pt-6">
        <Avviso tipo="avviso">{testi.comune.nonTrovato}</Avviso>
      </div>
    );
  }
  if (!id && candidatoId && candidati.isPending) {
    return <Caricamento descrizione={s.caricamento} righe={6} />;
  }
  const candidato = candidati.data?.find((voce) => voce.id === candidatoId) ?? null;
  const iniziale: Locale | null =
    locale.data ??
    (candidato
      ? {
          id: '',
          nome: candidato.nome ?? '',
          indirizzo: candidato.indirizzo ?? '',
          comune: candidato.comune ?? '',
          provincia: candidato.provincia ?? 'MI',
          lat: candidato.lat ?? CENTRO[1],
          lon: candidato.lon ?? CENTRO[0],
          osm_id: candidato.osm_id,
          google_place_id: candidato.google_place_id,
          sito_web: candidato.sito_web,
          instagram_username: null,
          attivo: true,
          immagine_path: null,
          immagine_fonte: null,
          immagine_attribuzione: null,
          immagine_riferimento: null,
          immagine_approvata_da: null,
          immagine_approvata_il: null,
          aggiornato_il: '',
        }
      : null);
  return (
    <ModuloLocale
      key={`${id ?? 'nuovo'}-${locale.data?.aggiornato_il ?? ''}`}
      locale={locale.data ?? null}
      iniziale={iniziale}
      candidatoId={candidato?.id ?? null}
    />
  );
}

function ModuloLocale({
  locale,
  iniziale,
  candidatoId,
}: {
  locale: Locale | null;
  iniziale: Locale | null;
  candidatoId: string | null;
}) {
  const router = useRouter();
  const client = useQueryClient();
  const [modulo, setModulo] = useState<Modulo>(() => moduloDa(iniziale));
  const [errori, setErrori] = useState<Errori>({});
  const [salvato, setSalvato] = useState(false);
  const [disattivazione, setDisattivazione] = useState(false);
  const cambia = <K extends keyof Modulo>(chiave: K, valore: Modulo[K]) => {
    setModulo((attuale) => ({ ...attuale, [chiave]: valore }));
    setSalvato(false);
  };

  const dati = (attivo = modulo.attivo): DatiLocale => ({
    nome: modulo.nome,
    indirizzo: modulo.indirizzo,
    comune: modulo.comune,
    provincia: modulo.provincia,
    lat: Number(modulo.lat),
    lon: Number(modulo.lon),
    sito_web: modulo.sito_web,
    instagram_username: modulo.instagram_username,
    attivo,
  });

  const salvataggio = useMutation({
    mutationFn: async () => {
      const nuovoId = await salvaLocale(locale?.id ?? null, dati());
      if (!locale && candidatoId) await decidiCandidato(candidatoId, 'creato', nuovoId, '');
      return nuovoId;
    },
    onSuccess: (nuovoId) => {
      setSalvato(true);
      void client.invalidateQueries({ queryKey: CHIAVI.tutto });
      if (!locale) router.replace(PERCORSI_MODERAZIONE.locale(nuovoId));
    },
  });

  function invia(evento: FormEvent) {
    evento.preventDefault();
    const trovati = valida(modulo);
    setErrori(trovati);
    if (Object.keys(trovati).length === 0) salvataggio.mutate();
  }

  const titolo = locale?.nome ?? s.nuovo;

  return (
    <>
      <Testata
        briciole={
          <nav className="briciole" aria-label={testi.locali.titolo}>
            <Link href={PERCORSI_MODERAZIONE.locali}>{testi.locali.titolo}</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{titolo}</span>
          </nav>
        }
        titolo={
          <>
            {titolo}
            {locale && (
              <Badge variante={locale.attivo ? 'successo' : 'testo'}>
                {locale.attivo ? testi.stati.attivo : testi.stati.nonAttivo}
              </Badge>
            )}
          </>
        }
        strumenti={
          <>
            {locale &&
              (locale.attivo ? (
                <Pulsante variante="secondario" onClick={() => setDisattivazione(true)}>
                  {s.disattiva}
                </Pulsante>
              ) : (
                <Pulsante
                  variante="secondario"
                  onClick={() => {
                    cambia('attivo', true);
                    void salvaLocale(locale.id, dati(true)).then(() =>
                      client.invalidateQueries({ queryKey: CHIAVI.tutto }),
                    );
                  }}
                >
                  {s.riattiva}
                </Pulsante>
              ))}
            <Pulsante
              variante="principale"
              type="submit"
              form="modulo-locale"
              caricamento={salvataggio.isPending}
            >
              {testi.comune.salva}
            </Pulsante>
          </>
        }
      />
      <div className="md-scorre">
        <div className="md-due">
          <div className="md-col">
            {salvato && (
              <div className="conferma-riga" role="status">
                <Icona icona={CircleCheck} dimensione="s" />
                {testi.comune.salvato}
              </div>
            )}
            {salvataggio.isError && (
              <Avviso tipo="errore" titolo={testi.comune.erroreSalvataggio.titolo} portaInVista>
                {testoErrore(salvataggio.error)}
              </Avviso>
            )}
            <form id="modulo-locale" className="md-sezione" onSubmit={invia} noValidate>
              <h2 className="etichetta-riga">{s.dati}</h2>
              <div className="campi2">
                <Campo
                  etichetta={s.nome}
                  value={modulo.nome}
                  maxLength={120}
                  errore={errori.nome}
                  onChange={(e) => cambia('nome', e.target.value)}
                  required
                />
                <Campo
                  etichetta={s.indirizzo}
                  value={modulo.indirizzo}
                  errore={errori.indirizzo}
                  onChange={(e) => cambia('indirizzo', e.target.value)}
                  required
                />
                <Campo
                  etichetta={s.comune}
                  value={modulo.comune}
                  errore={errori.comune}
                  onChange={(e) => cambia('comune', e.target.value)}
                  required
                />
                <Selezione
                  etichetta={s.provincia}
                  valore={modulo.provincia}
                  opzioni={[
                    { valore: 'MI', etichetta: s.province.MI },
                    { valore: 'MB', etichetta: s.province.MB },
                  ]}
                  onCambia={(valore) => cambia('provincia', valore)}
                />
                <Campo
                  etichetta={s.sito}
                  type="url"
                  value={modulo.sito_web}
                  errore={errori.sito_web}
                  placeholder="https://"
                  onChange={(e) => cambia('sito_web', e.target.value)}
                  facoltativo
                />
                <Campo
                  etichetta={s.instagram}
                  value={modulo.instagram_username}
                  errore={errori.instagram_username}
                  prefisso={<span className="c-2">@</span>}
                  onChange={(e) => cambia('instagram_username', e.target.value)}
                  facoltativo
                />
              </div>
              <h3 className="campo-etichetta">{s.posizione}</h3>
              <MappaPosizione
                urlPmtiles={process.env.NEXT_PUBLIC_MAPPA_PMTILES_URL}
                lat={Number(modulo.lat)}
                lon={Number(modulo.lon)}
                etichetta={s.mappa}
                etichettaSegnaposto={modulo.nome || s.segnaposto}
                onCambia={(lat, lon) => {
                  cambia('lat', String(lat));
                  cambia('lon', String(lon));
                }}
              />
              <div className="campi2">
                <Campo
                  etichetta={s.lat}
                  inputMode="decimal"
                  value={modulo.lat}
                  errore={errori.coordinate}
                  onChange={(e) => cambia('lat', e.target.value.replace(',', '.'))}
                />
                <Campo
                  etichetta={s.lon}
                  inputMode="decimal"
                  value={modulo.lon}
                  onChange={(e) => cambia('lon', e.target.value.replace(',', '.'))}
                />
              </div>
              <p className="guida">{s.aiutoPosizione}</p>
            </form>
            {locale && <FontiDelLocale localeId={locale.id} />}
            {locale && <ProssimiEventi localeId={locale.id} />}
          </div>
          <div className="md-col">
            {locale ? (
              <>
                <FotoLocale locale={locale} />
                <RegistroOggetto tipo="locale" id={locale.id} />
              </>
            ) : (
              <Avviso tipo="info">{testi.foto.salvaPrimaIlLocale}</Avviso>
            )}
          </div>
        </div>
      </div>
      {locale && (
        <DialogoMotivazione
          aperto={disattivazione}
          onChiudi={() => setDisattivazione(false)}
          titolo={s.disattivaTitolo(locale.nome)}
          effetto={s.disattivaEffetto}
          etichettaMotivazione={testi.comune.motivazione}
          aiutoMotivazione={testi.comune.restaNelRegistro}
          erroreMotivazioneMancante={testi.comune.motivazioneMancante}
          etichettaConferma={s.disattiva.replace('…', '')}
          etichettaAnnulla={testi.comune.annulla}
          variante="pericolo"
          testoErrore={testoErrore}
          onConferma={async (motivazione) => {
            await salvaLocale(locale.id, dati(false));
            await registraMotivazione('locale', locale.id, `${s.disattivato} ${motivazione}`);
            setDisattivazione(false);
            await client.invalidateQueries({ queryKey: CHIAVI.tutto });
          }}
        />
      )}
    </>
  );
}

function FontiDelLocale({ localeId }: { localeId: string }) {
  const fonti = useFontiLocale(localeId);
  return (
    <section className="md-sezione" aria-labelledby="fonti-locale">
      <div className="flex items-center justify-between gap-3">
        <h2 id="fonti-locale" className="etichetta-riga flex-1">
          {s.fonti}
          {fonti.data && <span className="t-mono-dato c-2"> · {fonti.data.length}</span>}
        </h2>
        <Link className="btn btn-secondario btn-s" href={PERCORSI_MODERAZIONE.nuovaFonte(localeId)}>
          <Icona icona={Plus} dimensione="s" />
          {s.aggiungiFonte}
        </Link>
      </div>
      {fonti.isPending && <Caricamento descrizione={testi.fonti.caricamento} righe={2} />}
      {fonti.data?.length === 0 && <p className="guida">{s.nessunaFonte}</p>}
      {fonti.data?.map((fonte) => (
        <div key={fonte.id} className="riga-dato">
          <span className="lbl">{testi.fonti.tipi[fonte.tipo]}</span>
          <Link className="t-mono-dato" href={PERCORSI_MODERAZIONE.fonte(fonte.id)}>
            {fonte.tipo === 'instagram' ? `@${fonte.url}` : urlBreve(fonte.url)}
          </Link>
          <span className="flex flex-wrap gap-1">
            <BadgeConformita conformita={fonte.stato_conformita} />
            <BadgeAttiva fonte={fonte} />
          </span>
        </div>
      ))}
    </section>
  );
}

function ProssimiEventi({ localeId }: { localeId: string }) {
  const oggi = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
  const eventi = useQuery({
    queryKey: [...CHIAVI.eventi, 'locale', localeId],
    queryFn: () => leggiEventi({ testo: '', stati: [], dal: oggi, al: null, locale: localeId }),
  });
  return (
    <section className="md-sezione" aria-labelledby="prossimi-eventi">
      <h2 id="prossimi-eventi" className="etichetta-riga">
        {s.prossimi}
      </h2>
      {eventi.isPending && <Caricamento descrizione={testi.eventi.caricamento} righe={2} />}
      {eventi.data?.length === 0 && <p className="guida">{s.nessunEvento}</p>}
      {eventi.data?.slice(0, 10).map((evento) => (
        <div key={evento.id} className="riga-dato">
          <span className="lbl">{serata(evento.data_serata)}</span>
          <Link href={PERCORSI_MODERAZIONE.evento(evento.id)}>{evento.titolo}</Link>
          <span className="flex gap-1">
            <Badge variante="eta">
              {etichettaEta(evento.eta_minima, evento.eta_minima_dichiarata)}
            </Badge>
            <Badge variante="testo">{testi.stati.evento[evento.stato]}</Badge>
          </span>
        </div>
      ))}
    </section>
  );
}
