'use client';

import {
  BookOpen,
  Check,
  CloudOff,
  Coins,
  Plus,
  Search,
  ShieldCheck,
  Shirt,
  Ticket,
  TrainFront,
  Utensils,
  CupSoda,
  CircleDollarSign,
  X,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { z } from 'zod';
import { Avatar } from '@/components/ui/Avatar';
import { Avviso } from '@/components/ui/Avviso';
import { Campo } from '@/components/ui/Campo';
import { Icona } from '@/components/ui/Icona';
import { TitoloRivelato } from '@/components/ui/Movimento';
import { Pulsante } from '@/components/ui/Pulsante';
import { Caricamento, ElencoVuoto } from '@/components/ui/Stati';
import { useAmici, useIo } from '@/features/amici/dati';
import { useEvento } from '@/features/scopri/dati';
import { classi } from '@/lib/classi';
import { dataIso, oggiARoma } from '@/lib/date';
import { ErroreAutorizzazione, ErroreValidazione } from '@/lib/errori';
import { messaggi } from '@/lib/messaggi/it';
import type { CategoriaSpesa, PersonaDiario, RisultatoDove, Salvataggio, Voce } from './api';
import type { VoceMostrata } from './coda';
import { useCategorieSpesa, useCercaDove, useSalvaSerata, useVoce } from './dati';
import { EtichettaPrivato } from './Diario';
import {
  dataMedia,
  euro,
  importoInCampo,
  leggiImporto,
  oraRoma,
  partiData,
  totaleSpese,
  titoloVoce,
} from './formato';

const testi = messaggi.ricorda.modulo;
const categorie = messaggi.ricorda.categorie;

export const ICONE_CATEGORIA: Record<CategoriaSpesa, LucideIcon> = {
  ingresso: Ticket,
  prevendita: Ticket,
  trasporto: TrainFront,
  cibo: Utensils,
  bevande_analcoliche: CupSoda,
  // R-40: la categoria esiste solo per i maggiorenni e nessuna icona richiama l'alcol.
  alcolici: Coins,
  guardaroba: Shirt,
  altro: CircleDollarSign,
};

/** Evento scelto nel campo «Dove». */
type EventoScelto = {
  id: string;
  titolo: string;
  inizio: string;
  data_serata: string;
  locale_id: string;
  locale_nome: string;
  comune: string;
};
type LocaleScelto = { id: string; nome: string; comune: string };

type Iniziale = {
  id: string;
  nuova: boolean;
  evento: EventoScelto | null;
  locale: LocaleScelto | null;
  nomeLibero: string;
  data: string;
  amici: PersonaDiario[];
  amiciAltri: number;
  spese: { categoria: CategoriaSpesa; testo: string }[];
  dj: string[];
  voto: number | null;
  note: string;
  creatoIl: string;
};

const vuota = (id: string): Iniziale => ({
  id,
  nuova: true,
  evento: null,
  locale: null,
  nomeLibero: '',
  data: '',
  amici: [],
  amiciAltri: 0,
  spese: [],
  dj: [],
  voto: null,
  note: '',
  creatoIl: new Date().toISOString(),
});

function daVoce(voce: VoceMostrata): Iniziale {
  return {
    id: voce.id,
    nuova: false,
    evento:
      voce.evento && voce.locale
        ? {
            id: voce.evento.id,
            titolo: voce.evento.titolo,
            inizio: voce.evento.inizio,
            data_serata: voce.data_serata,
            locale_id: voce.locale.id,
            locale_nome: voce.locale.nome,
            comune: voce.locale.comune,
          }
        : null,
    locale: !voce.evento && voce.locale ? voce.locale : null,
    nomeLibero: voce.nome_locale_libero ?? '',
    data: voce.data_serata,
    amici: voce.amici,
    amiciAltri: voce.amici_altri,
    spese: voce.spese.map((s) => ({
      categoria: s.categoria,
      testo: importoInCampo(s.importo_centesimi),
    })),
    dj: voce.dj,
    voto: voce.voto,
    note: voce.note ?? '',
    creatoIl: voce.creato_il,
  };
}

const uuidValido = (valore: string | null) => (z.uuid().safeParse(valore).success ? valore : null);

/**
 * Aggiungi o modifica una serata (design/F-30-tracker §2). `?id=` modifica una serata del
 * diario; `?evento=` apre il modulo già compilato da "Ero a questo evento" (§4).
 */
export function ModuloSerata() {
  const parametri = useSearchParams();
  const idVoce = uuidValido(parametri.get('id'));
  const idEvento = uuidValido(parametri.get('evento'));
  const voce = useVoce(idVoce);
  const evento = useEvento(idVoce ? null : idEvento);
  const [nuovoId] = useState(() => crypto.randomUUID());

  if (idVoce) {
    if (voce.stato === 'caricamento') return <Caricamento descrizione={testi.caricamento} />;
    if (voce.stato !== 'voce' || !voce.voce) return <VoceNonTrovata />;
    return <Modulo iniziale={daVoce(voce.voce)} />;
  }
  if (idEvento) {
    if (evento.isPending && evento.fetchStatus !== 'idle')
      return <Caricamento descrizione={testi.caricamento} />;
    const e = evento.data;
    if (e && e.data_serata <= dataIso(oggiARoma())) {
      return (
        <Modulo
          iniziale={{
            ...vuota(nuovoId),
            evento: {
              id: e.id,
              titolo: e.titolo,
              inizio: e.inizio,
              data_serata: e.data_serata,
              locale_id: e.locale_id,
              locale_nome: e.locale_nome,
              comune: e.locale_comune,
            },
            data: e.data_serata,
          }}
        />
      );
    }
  }
  return <Modulo iniziale={vuota(nuovoId)} />;
}

function VoceNonTrovata() {
  const d = messaggi.ricorda.dettaglio.nonTrovata;
  return (
    <ElencoVuoto
      icona={BookOpen}
      titolo={d.titolo}
      azione={
        <Link className="btn btn-secondario btn-s" href="/ricorda/">
          {d.torna}
        </Link>
      }
    >
      {d.testo}
    </ElencoVuoto>
  );
}

type TipoErrore = 'data' | 'futura' | 'importo' | 'nome';

function Modulo({ iniziale }: { iniziale: Iniziale }) {
  const salva = useSalvaSerata();
  const oggi = dataIso(oggiARoma());
  const [evento, setEvento] = useState(iniziale.evento);
  const [locale, setLocale] = useState(iniziale.locale);
  const [scrivi, setScrivi] = useState(iniziale.nomeLibero !== '');
  const [nomeLibero, setNomeLibero] = useState(iniziale.nomeLibero);
  const [data, setData] = useState(iniziale.data);
  const [amici, setAmici] = useState<PersonaDiario[]>(iniziale.amici);
  const [spese, setSpese] = useState(iniziale.spese);
  const [dj, setDj] = useState(iniziale.dj);
  const [voto, setVoto] = useState(iniziale.voto);
  const [note, setNote] = useState(iniziale.note);
  const [inviato, setInviato] = useState(false);
  const [esito, setEsito] = useState<{ offline: boolean; quando: string } | null>(null);

  const nome = nomeLibero.trim();
  const errori: Partial<Record<TipoErrore, string>> = {};
  const importiErrati = new Set<CategoriaSpesa>();
  if (!data) errori.data = testi.errori.dataMancante;
  else if (data > oggi) errori.futura = testi.errori.dataFutura;
  for (const spesa of spese) {
    if (leggiImporto(spesa.testo) === null) importiErrati.add(spesa.categoria);
  }
  const primoImporto = spese.find((s) => importiErrati.has(s.categoria));
  if (primoImporto) errori.importo = testi.errori.importo(categorie[primoImporto.categoria]);
  if (scrivi && nome.length > 80) errori.nome = testi.errori.nomeLungo(nome.length - 80);
  const tipoErrore = (['data', 'futura', 'nome', 'importo'] as const).find((t) => errori[t]);
  const mostra = inviato && tipoErrore !== undefined;

  const invia = (e: FormEvent) => {
    e.preventDefault();
    setInviato(true);
    if (tipoErrore) return;
    const dati: Salvataggio = {
      id: iniziale.id,
      data_serata: evento ? evento.data_serata : data,
      evento_id: evento?.id ?? null,
      locale_id: evento ? evento.locale_id : (locale?.id ?? null),
      nome_locale_libero: !evento && !locale && scrivi && nome ? nome : null,
      voto,
      note: note.trim() ? note : null,
      spese: spese.map((s) => ({
        categoria: s.categoria,
        importo_centesimi: leggiImporto(s.testo)!,
      })),
      dj,
      amici: amici.map((a) => a.id),
    };
    const anteprima: Voce = {
      id: dati.id,
      data_serata: dati.data_serata,
      evento: evento
        ? { id: evento.id, titolo: evento.titolo, inizio: evento.inizio, stato: 'pubblicato' }
        : null,
      locale: evento
        ? { id: evento.locale_id, nome: evento.locale_nome, comune: evento.comune }
        : locale,
      nome_locale_libero: dati.nome_locale_libero,
      voto,
      note: dati.note,
      spese: dati.spese,
      dj,
      amici,
      amici_altri: iniziale.amiciAltri,
      creato_il: iniziale.creatoIl,
      aggiornato_il: new Date().toISOString(),
    };
    salva.mutate(
      { dati, anteprima },
      {
        onSuccess: ({ offline }) =>
          setEsito({
            offline,
            quando: `${dataMedia(dati.data_serata)} · ${titoloVoce(anteprima) || ''}`.replace(
              / · $/,
              '',
            ),
          }),
      },
    );
  };

  if (esito) return <Salvata offline={esito.offline} quando={esito.quando} />;

  const titoloErrore = tipoErrore ? testi.errori.titolo[tipoErrore] : testi.errori.titolo.generico;

  return (
    <form className="flex flex-col" onSubmit={invia} noValidate>
      <div className="ri-testa-barra pb-2">
        <Link
          className="btn btn-testo btn-s -ml-3"
          href={iniziale.nuova ? '/ricorda/' : `/ricorda/serata/?id=${iniziale.id}`}
          aria-label={testi.chiudi}
        >
          <Icona icona={X} />
        </Link>
        <EtichettaPrivato />
      </div>
      <span className="etichetta">{testi.sopratitolo}</span>
      <TitoloRivelato
        testo={iniziale.nuova ? testi.nuova : testi.modifica}
        className="t-display m-0"
      />
      <p className="t-corpo-s c-2 mt-1 mb-2">{testi.intro}</p>

      {mostra && (
        <Avviso tipo="errore" titolo={titoloErrore} portaInVista>
          {testi.errori.correggi}
        </Avviso>
      )}
      {salva.isError && (
        <Avviso tipo="errore" titolo={testi.errori.titolo.generico} portaInVista>
          {erroreSalvataggio(salva.error)}
        </Avviso>
      )}

      <SezioneDove
        evento={evento}
        locale={locale}
        scrivi={scrivi}
        nome={nomeLibero}
        errore={inviato ? errori.nome : undefined}
        onEvento={(scelto) => {
          setEvento(scelto);
          setLocale(null);
          if (scelto) setData(scelto.data_serata);
        }}
        onLocale={(scelto) => {
          setLocale(scelto);
          setEvento(null);
        }}
        onScrivi={setScrivi}
        onNome={setNomeLibero}
      />

      <fieldset className="ri-sez">
        <div className="ri-sez-testa">
          <legend>{messaggi.ricorda.modulo.quando}</legend>
          <span>{testi.obbligatorio}</span>
        </div>
        <Campo
          etichetta={testi.data}
          type="date"
          max={oggi}
          required
          value={evento ? evento.data_serata : data}
          disabled={evento !== null}
          aiuto={evento ? testi.dataDaEvento : undefined}
          errore={inviato ? (errori.data ?? errori.futura) : undefined}
          onChange={(e) => setData(e.target.value)}
        />
      </fieldset>

      <SezioneAmici scelti={amici} altri={iniziale.amiciAltri} onCambia={setAmici} />

      <SezioneSpese
        spese={spese}
        errate={inviato ? importiErrati : new Set()}
        onCambia={setSpese}
      />

      <SezioneMusica dj={dj} onCambia={setDj} />

      <fieldset className="ri-sez">
        <div className="ri-sez-testa">
          <legend>{testi.comeAndata}</legend>
          <span>{testi.facoltativo}</span>
        </div>
        <Voto valore={voto} onCambia={setVoto} />
        <NoteSerata valore={note} onCambia={setNote} />
      </fieldset>

      <div className="gr-barra-fondo">
        <span className="t-corpo-s c-2">{testi.piede}</span>
        <Pulsante
          type="submit"
          variante="principale"
          disabled={salva.isPending}
          caricamento={salva.isPending}
        >
          {testi.salva}
        </Pulsante>
      </div>
    </form>
  );
}

function erroreSalvataggio(errore: unknown): string {
  if (errore instanceof ErroreValidazione) {
    if (errore.codice === 'data_futura') return testi.errori.dataFutura;
    if (errore.codice === 'valore_non_ammesso') return testi.errori.generico;
  }
  if (errore instanceof ErroreAutorizzazione) return testi.errori.eventoNonDisponibile;
  return testi.errori.generico;
}

/** Conferma dopo il salvataggio, online oppure solo sul telefono. */
function Salvata({ offline, quando }: { offline: boolean; quando: string }) {
  const t = offline ? testi.salvataOffline : testi.salvata;
  return (
    <div className="flex flex-col gap-4 pt-3" role="status">
      <span className="cornice-icona" aria-hidden="true">
        <Icona icona={offline ? CloudOff : Check} />
      </span>
      <h2 className="t-titolo-1 m-0">{t.titolo}</h2>
      <p className="t-corpo m-0">
        {offline ? testi.salvataOffline.testo : testi.salvata.testo(quando)}
      </p>
      <Link className="btn btn-secondario btn-pieno" href="/ricorda/">
        {testi.salvata.torna}
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Dove
// ---------------------------------------------------------------------------------------------

function SezioneDove({
  evento,
  locale,
  scrivi,
  nome,
  errore,
  onEvento,
  onLocale,
  onScrivi,
  onNome,
}: {
  evento: EventoScelto | null;
  locale: LocaleScelto | null;
  scrivi: boolean;
  nome: string;
  errore: string | undefined;
  onEvento: (evento: EventoScelto | null) => void;
  onLocale: (locale: LocaleScelto | null) => void;
  onScrivi: (scrivi: boolean) => void;
  onNome: (nome: string) => void;
}) {
  const [cerca, setCerca] = useState('');
  const risultati = useCercaDove(scrivi || evento || locale ? '' : cerca);
  const scegli = (r: RisultatoDove) => {
    if (r.tipo === 'evento' && r.data_serata && r.inizio) {
      onEvento({
        id: r.id,
        titolo: r.titolo,
        inizio: r.inizio,
        data_serata: r.data_serata,
        locale_id: r.locale_id,
        locale_nome: r.locale_nome,
        comune: r.comune,
      });
    } else {
      onLocale({ id: r.locale_id, nome: r.locale_nome, comune: r.comune });
    }
    setCerca('');
  };

  let contenuto;
  if (evento) {
    const { giorno, data } = partiData(evento.data_serata);
    contenuto = (
      <div className="ri-evento">
        <span className="ri-evento-ora" aria-hidden="true">
          <span>{oraRoma(evento.inizio)}</span>
          <span>{giorno}</span>
        </span>
        <span className="min-w-0">
          <b>{evento.titolo}</b>
          <small>
            {evento.locale_nome} · {evento.comune} · {giorno} {data}
          </small>
        </span>
        <Pulsante
          variante="testo"
          soloIcona
          aria-label={testi.togli(evento.titolo)}
          onClick={() => onEvento(null)}
        >
          <Icona icona={X} />
        </Pulsante>
      </div>
    );
  } else if (locale) {
    contenuto = (
      <div className="ri-evento">
        <span className="ri-evento-ora" aria-hidden="true" />
        <span className="min-w-0">
          <b>{locale.nome}</b>
          <small>{locale.comune}</small>
        </span>
        <Pulsante
          variante="testo"
          soloIcona
          aria-label={testi.togli(locale.nome)}
          onClick={() => onLocale(null)}
        >
          <Icona icona={X} />
        </Pulsante>
      </div>
    );
  } else if (scrivi) {
    contenuto = (
      <>
        <Campo
          etichetta={testi.nomeLocale}
          value={nome}
          conteggio={{ attuale: nome.trim().length, massimo: 80 }}
          aiuto={testi.nomeLocaleAiuto}
          errore={errore}
          onChange={(e) => onNome(e.target.value)}
          autoComplete="off"
        />
        <button type="button" className="link self-start" onClick={() => onScrivi(false)}>
          {testi.cercaNelCatalogo}
        </button>
      </>
    );
  } else {
    contenuto = (
      <>
        <Campo
          etichetta={testi.cerca}
          type="search"
          value={cerca}
          onChange={(e) => setCerca(e.target.value)}
          prefisso={<Icona icona={Search} dimensione="s" />}
          autoComplete="off"
        />
        {cerca.trim().length >= 2 && (
          <div aria-live="polite">
            {risultati.isPending ? (
              <Caricamento descrizione={testi.cercaCaricamento} righe={2} />
            ) : risultati.isError ? (
              <p className="t-corpo-s c-2 m-0">{testi.cercaErrore}</p>
            ) : risultati.data.length === 0 ? (
              <p className="t-corpo-s c-2 m-0">{testi.cercaNessuno}</p>
            ) : (
              <ElencoRisultati risultati={risultati.data} onScegli={scegli} />
            )}
          </div>
        )}
        <button type="button" className="link self-start" onClick={() => onScrivi(true)}>
          {testi.scriviNome}
        </button>
      </>
    );
  }

  return (
    <fieldset className="ri-sez">
      <div className="ri-sez-testa">
        <legend>{testi.dove}</legend>
        <span>{testi.facoltativo}</span>
      </div>
      {contenuto}
    </fieldset>
  );
}

function ElencoRisultati({
  risultati,
  onScegli,
}: {
  risultati: RisultatoDove[];
  onScegli: (risultato: RisultatoDove) => void;
}) {
  const eventi = risultati.filter((r) => r.tipo === 'evento');
  const locali = risultati.filter((r) => r.tipo === 'locale');
  return (
    <div className="flex flex-col gap-2">
      {eventi.length > 0 && (
        <>
          <h3 className="etichetta m-0">{testi.eventi}</h3>
          <ul className="ri-risultati">
            {eventi.map((r) => (
              <li key={`e-${r.id}`}>
                <button type="button" className="ri-risultato" onClick={() => onScegli(r)}>
                  <b>{r.titolo}</b>
                  <small>
                    {r.locale_nome} · {r.comune}
                    {r.data_serata
                      ? ` · ${partiData(r.data_serata).giorno} ${partiData(r.data_serata).data}`
                      : ''}
                  </small>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {locali.length > 0 && (
        <>
          <h3 className="etichetta m-0">{testi.locali}</h3>
          <ul className="ri-risultati">
            {locali.map((r) => (
              <li key={`l-${r.id}`}>
                <button type="button" className="ri-risultato" onClick={() => onScegli(r)}>
                  <b>{r.titolo}</b>
                  <small>{r.comune}</small>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Con chi
// ---------------------------------------------------------------------------------------------

const normalizza = (testo: string) =>
  testo.toLocaleLowerCase('it').normalize('NFD').replace(/[̀-ͯ]/g, '');

function SezioneAmici({
  scelti,
  altri,
  onCambia,
}: {
  scelti: PersonaDiario[];
  altri: number;
  onCambia: (scelti: PersonaDiario[]) => void;
}) {
  const [testo, setTesto] = useState('');
  const amici = useAmici();
  // Gli amici confermati, più chi è già indicato nella serata (anche se ora non lo è più).
  const confermati: PersonaDiario[] = (amici.data?.amici ?? []).map((r) => ({
    id: r.persona.id,
    username: r.persona.username,
    nome_visualizzato: r.persona.nome_visualizzato,
    avatar_path: r.persona.avatar_path ?? null,
  }));
  const tutti = [...confermati, ...scelti.filter((s) => !confermati.some((c) => c.id === s.id))];
  const filtro = normalizza(testo.trim().replace(/^@/, ''));
  const visibili = tutti.filter(
    (p) =>
      !filtro ||
      normalizza(p.nome_visualizzato).includes(filtro) ||
      normalizza(p.username).includes(filtro),
  );
  const cambia = (persona: PersonaDiario) =>
    onCambia(
      scelti.some((s) => s.id === persona.id)
        ? scelti.filter((s) => s.id !== persona.id)
        : [...scelti, persona],
    );

  let elenco;
  if (amici.isPending && tutti.length === 0) {
    elenco = <Caricamento descrizione={testi.amiciCaricamento} righe={2} />;
  } else if (amici.isError && tutti.length === 0) {
    elenco = <p className="t-corpo-s c-2 m-0">{testi.amiciErrore}</p>;
  } else if (tutti.length === 0) {
    elenco = <p className="t-corpo-s c-2 m-0">{testi.nessunAmico}</p>;
  } else if (visibili.length === 0) {
    elenco = <p className="t-corpo-s c-2 m-0">{testi.nessunRisultatoAmici}</p>;
  } else {
    elenco = (
      <ul className="m-0 list-none p-0">
        {visibili.map((persona) => {
          const scelto = scelti.some((s) => s.id === persona.id);
          return (
            <li key={persona.id}>
              <button
                type="button"
                role="checkbox"
                className="sel-riga"
                aria-checked={scelto}
                onClick={() => cambia(persona)}
              >
                <span className={classi('casella', scelto && 'is-on')} aria-hidden="true">
                  {scelto && <Icona icona={Check} dimensione="s" />}
                </span>
                <Avatar nome={persona.nome_visualizzato} foto={persona.avatar_path} decorativo />
                <span className="min-w-0">
                  <span className="sel-nome">{persona.nome_visualizzato}</span>
                  <span className="sel-username">@{persona.username}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <fieldset className="ri-sez">
      <div className="ri-sez-testa">
        <legend>{testi.conChi}</legend>
        <span className="mono" aria-live="polite">
          {testi.selezionati(scelti.length)}
        </span>
      </div>
      <p className="sel-regola m-0">
        <Icona icona={ShieldCheck} />
        <span>{testi.regolaAmici}</span>
      </p>
      {tutti.length > 0 && (
        <Campo
          etichetta={testi.cercaAmici}
          type="search"
          value={testo}
          onChange={(e) => setTesto(e.target.value)}
          prefisso={<Icona icona={Search} dimensione="s" />}
          autoComplete="off"
        />
      )}
      {elenco}
      {altri > 0 && <p className="t-corpo-s c-2 m-0">{testi.altriAmici(altri)}</p>}
    </fieldset>
  );
}

// ---------------------------------------------------------------------------------------------
// Spese
// ---------------------------------------------------------------------------------------------

function SezioneSpese({
  spese,
  errate,
  onCambia,
}: {
  spese: { categoria: CategoriaSpesa; testo: string }[];
  errate: ReadonlySet<CategoriaSpesa>;
  onCambia: (spese: { categoria: CategoriaSpesa; testo: string }[]) => void;
}) {
  const disponibili = useCategorieSpesa();
  const io = useIo();
  const totale = totaleSpese(
    spese.flatMap((s) => {
      const importo = leggiImporto(s.testo);
      return importo === null ? [] : [{ categoria: s.categoria, importo_centesimi: importo }];
    }),
  );
  const aggiungibili = (disponibili.data ?? []).filter(
    (c) => !spese.some((s) => s.categoria === c),
  );

  return (
    <fieldset className="ri-sez">
      <div className="ri-sez-testa">
        <legend>{testi.spese}</legend>
        <span>{testi.speseAiuto}</span>
      </div>
      {spese.length > 0 && (
        <ul className="m-0 list-none p-0">
          {spese.map((spesa) => {
            const errata = errate.has(spesa.categoria);
            const nome = categorie[spesa.categoria];
            return (
              <li key={spesa.categoria} className="ri-spesa">
                <span className="ri-spesa-cat">
                  <Icona icona={ICONE_CATEGORIA[spesa.categoria]} />
                  {nome}
                </span>
                <label className={classi('ri-importo', errata && 'is-errore')}>
                  <span aria-hidden="true">€</span>
                  <input
                    inputMode="decimal"
                    autoComplete="off"
                    aria-label={testi.importo(nome)}
                    aria-invalid={errata || undefined}
                    value={spesa.testo}
                    onChange={(e) =>
                      onCambia(
                        spese.map((s) =>
                          s.categoria === spesa.categoria ? { ...s, testo: e.target.value } : s,
                        ),
                      )
                    }
                  />
                </label>
                <Pulsante
                  variante="testo"
                  soloIcona
                  aria-label={testi.togliSpesa(nome)}
                  onClick={() => onCambia(spese.filter((s) => s.categoria !== spesa.categoria))}
                >
                  <Icona icona={X} />
                </Pulsante>
              </li>
            );
          })}
        </ul>
      )}
      {spese.length > 0 && (
        <p className="ri-totale m-0">
          <span aria-hidden="true">{testi.totale}</span>
          <span className="mono" aria-hidden="true">
            {euro(totale)}
          </span>
          <span className="sr-only" aria-live="polite">
            {testi.totaleLettura(euro(totale))}
          </span>
        </p>
      )}
      {errate.size > 0 && (
        <p className="campo-errore m-0" role="alert">
          {testi.errori.importo(categorie[[...errate][0]!])}
        </p>
      )}
      {io && aggiungibili.length > 0 && (
        <div className="ri-categorie" role="group" aria-label={testi.aggiungiSpesa}>
          <span className="t-corpo-s">{testi.aggiungiSpesa}</span>
          <div>
            {aggiungibili.map((categoria) => (
              <Pulsante
                key={categoria}
                variante="secondario"
                dimensione="s"
                onClick={() => onCambia([...spese, { categoria, testo: '' }])}
              >
                <Icona icona={Plus} dimensione="s" />
                {categorie[categoria]}
              </Pulsante>
            ))}
          </div>
        </div>
      )}
    </fieldset>
  );
}

// ---------------------------------------------------------------------------------------------
// Musica, voto e note
// ---------------------------------------------------------------------------------------------

function SezioneMusica({ dj, onCambia }: { dj: string[]; onCambia: (dj: string[]) => void }) {
  const [testo, setTesto] = useState('');
  const pulito = testo.trim();
  const aggiungi = () => {
    if (!pulito || pulito.length > 80 || dj.length >= 20) return;
    if (!dj.some((d) => d.toLocaleLowerCase('it') === pulito.toLocaleLowerCase('it')))
      onCambia([...dj, pulito]);
    setTesto('');
  };
  const tasto = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      aggiungi();
    }
  };
  return (
    <fieldset className="ri-sez">
      <div className="ri-sez-testa">
        <legend>{testi.musica}</legend>
        <span>{testi.facoltativo}</span>
      </div>
      {dj.length > 0 && (
        <ul className="ri-etichette">
          {dj.map((nome) => (
            <li key={nome} className="ri-etichetta">
              {nome}
              <button
                type="button"
                aria-label={testi.togliDj(nome)}
                onClick={() => onCambia(dj.filter((d) => d !== nome))}
              >
                <Icona icona={X} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {dj.length < 20 && (
        <Campo
          etichetta={testi.dj}
          value={testo}
          maxLength={80}
          aiuto={testi.djAiuto}
          onChange={(e) => setTesto(e.target.value)}
          onKeyDown={tasto}
          autoComplete="off"
          suffisso={
            <Pulsante variante="testo" dimensione="s" disabled={!pulito} onClick={aggiungi}>
              {testi.aggiungiDj}
            </Pulsante>
          }
        />
      )}
    </fieldset>
  );
}

/** Voto da 1 a 5: cinque pulsanti, non stelle da trascinare (design/F-30-tracker §2). */
export function Voto({
  valore,
  onCambia,
}: {
  valore: number | null;
  onCambia: (voto: number | null) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="ri-voto" role="group" aria-label={testi.voto}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={valore === n}
            aria-label={testi.votoPulsante(n)}
            onClick={() => onCambia(valore === n ? null : n)}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="ri-voto-leggenda" aria-hidden="true">
        <span>{testi.votoMin}</span>
        <span>{testi.votoMax}</span>
      </div>
    </div>
  );
}

function NoteSerata({ valore, onCambia }: { valore: string; onCambia: (note: string) => void }) {
  return (
    <div className="campo-area">
      <label className="campo-riga" htmlFor="diario-note">
        <span className="campo-etichetta">{testi.note}</span>
        <span className="campo-conta" aria-hidden="true">
          {valore.length}/1000
        </span>
      </label>
      <textarea
        id="diario-note"
        maxLength={1000}
        value={valore}
        aria-describedby="diario-note-aiuto"
        onChange={(e) => onCambia(e.target.value)}
      />
      <p className="campo-aiuto m-0" id="diario-note-aiuto">
        {testi.noteAiuto}
      </p>
    </div>
  );
}
