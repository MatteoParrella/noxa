'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Clock, Lock, MapPin, Search, User, X } from 'lucide-react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Avviso } from '@/components/ui/Avviso';
import { Campo } from '@/components/ui/Campo';
import { Foglio } from '@/components/ui/Foglio';
import { Icona } from '@/components/ui/Icona';
import { Pulsante } from '@/components/ui/Pulsante';
import { Caricamento } from '@/components/ui/Stati';
import { useToast } from '@/components/ui/Toast';
import { useAmici } from '@/features/amici/dati';
import { FoglioPermesso } from '@/features/notifiche/FoglioPermesso';
import { giaSuggerito, segnaSuggerito, useDispositivi } from '@/features/notifiche/datiPush';
import { statoPush } from '@/features/notifiche/push';
import { ora } from '@/features/scopri/formato';
import { classi } from '@/lib/classi';
import { ErroreRete, ErroreValidazione } from '@/lib/errori';
import { useOnline } from '@/lib/connessione';
import { messaggi } from '@/lib/messaggi/it';
import { elencoNomi } from '@/lib/messaggi/vivi';
import { registraErrore } from '@/lib/registro';
import { faiCheckin, type Persona } from './api';
import { CHIAVI, useCercaLocali, useSuggerimenti } from './dati';

const testi = messaggi.vivi.fai;

type Scelta = {
  localeId: string;
  locale: string;
  dettaglio: string;
  eventoId: string | null;
  evento: string | null;
  /** Chiave del suggerimento scelto, per il radio selezionato. */
  chiave: string | null;
};

type Proposta = { titolo: string; amici: string[] };

/** Normalizza per la ricerca locale: minuscole e senza accenti. */
const normalizza = (testo: string) =>
  testo.toLocaleLowerCase('it').normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Foglio "Fai check-in" (design/F-20-checkin §2): dove (suggerimenti di stasera o ricerca per
 * nome, mai la posizione del telefono), chi lo vede (amici confermati, proposti quelli della
 * serata di gruppo), riepilogo con l'orario di fine scritto (R-30).
 */
export function FoglioCheckin({ aperto, onChiudi }: { aperto: boolean; onChiudi: () => void }) {
  return (
    <Foglio aperto={aperto} onChiudi={onChiudi} titolo={testi.titolo}>
      {aperto && <Contenuto onChiudi={onChiudi} />}
    </Foglio>
  );
}

function Contenuto({ onChiudi }: { onChiudi: () => void }) {
  const client = useQueryClient();
  const mostraToast = useToast();
  const online = useOnline();
  const suggerimenti = useSuggerimenti(true);
  const amici = useAmici();
  const dispositivi = useDispositivi();
  const [passo, setPasso] = useState<1 | 2 | 3 | 'esito'>(1);
  const [scelta, setScelta] = useState<Scelta | null>(null);
  const [selezionati, setSelezionati] = useState<string[]>([]);
  const [proposta, setProposta] = useState<Proposta | null>(null);
  const [esclusi, setEsclusi] = useState<string[]>([]);
  const [inviati, setInviati] = useState(0);
  const [permesso, setPermesso] = useState(false);

  const persone = new Map<string, Persona>(
    (amici.data?.amici ?? []).map((relazione) => [relazione.persona.id, relazione.persona]),
  );
  const nomi = (ids: readonly string[]) =>
    ids.flatMap((id) => {
      const persona = persone.get(id);
      return persona ? [persona.nome_visualizzato] : [];
    });

  const invio = useMutation({
    mutationFn: () =>
      faiCheckin({
        locale: scelta!.localeId,
        evento: scelta!.eventoId,
        destinatari: selezionati,
      }),
    onSuccess: (esito) => {
      void client.invalidateQueries({ queryKey: CHIAVI.vivi });
      mostraToast({ testo: testi.fatto(esito.destinatari.length) });
      setEsclusi(esito.esclusi);
      setInviati(esito.destinatari.length);
      // Il suggerimento delle notifiche compare una volta sola, dopo il primo check-in
      // (design/F-22-notifiche §1), e mai se le notifiche sono già attive o non possibili.
      const suggerisci =
        !giaSuggerito() &&
        statoPush() === 'da_chiedere' &&
        !(dispositivi.data ?? []).some((d) => d.questo);
      if (suggerisci) segnaSuggerito();
      if (esito.esclusi.length > 0 || suggerisci) setPasso('esito');
      else onChiudi();
    },
    onError: (errore) => {
      if (!(errore instanceof ErroreValidazione) && !(errore instanceof ErroreRete))
        registraErrore('check-in', errore);
    },
  });

  const vaiAChi = () => {
    // Gli amici della serata di stasera arrivano già spuntati, una volta (si possono togliere).
    if (!proposta) {
      const serate = suggerimenti.data?.serate ?? [];
      const serata =
        serate.find((s) => s.locale_id === scelta?.localeId && s.amici.length > 0) ??
        serate.find((s) => s.amici.length > 0);
      if (serata) {
        const validi = serata.amici.filter((id) => persone.has(id));
        setProposta({ titolo: serata.titolo, amici: validi });
        if (selezionati.length === 0) setSelezionati(validi);
      } else {
        setProposta({ titolo: '', amici: [] });
      }
    }
    setPasso(2);
  };

  if (passo === 'esito') {
    return (
      <div className="flex flex-col gap-4" aria-live="polite">
        <Avviso tipo="successo">{testi.fatto(inviati)}</Avviso>
        {esclusi.length > 0 && (
          <Avviso tipo="info" titolo={testi.esclusi.titolo(elencoNomi(nomi(esclusi)))}>
            {testi.esclusi.testo}
          </Avviso>
        )}
        {statoPush() === 'da_chiedere' && (
          <div className="nf-sugg">
            <p>{testi.suggerimentoPush}</p>
            <div className="az">
              <Pulsante variante="secondario" dimensione="s" onClick={() => setPermesso(true)}>
                {testi.suggerimentoPushAzione}
              </Pulsante>
            </div>
          </div>
        )}
        <Pulsante variante="principale" pieno onClick={onChiudi}>
          {messaggi.push.foglio.attive.fatto}
        </Pulsante>
        <FoglioPermesso aperto={permesso} onChiudi={() => setPermesso(false)} />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <Passo
        numero={1}
        titolo={testi.dove.titolo}
        stato={passo === 1 ? 'ora' : 'fatto'}
        riassunto={
          scelta
            ? scelta.evento
              ? `${scelta.evento} · ${scelta.locale}`
              : scelta.locale
            : undefined
        }
        onCambia={() => setPasso(1)}
      >
        <PassoDove
          scelta={scelta}
          onScegli={setScelta}
          suggerimenti={suggerimenti}
          onContinua={vaiAChi}
        />
      </Passo>
      <Passo
        numero={2}
        titolo={testi.chi.titolo}
        stato={passo === 2 ? 'ora' : passo === 3 ? 'fatto' : 'dopo'}
        riassunto={passo === 3 ? elencoNomi(nomi(selezionati)) : undefined}
        conteggio={passo === 2 ? testi.chi.conteggio(selezionati.length) : undefined}
        onCambia={() => setPasso(2)}
      >
        {amici.isPending ? (
          <Caricamento descrizione={testi.chi.caricamento} righe={3} />
        ) : amici.isError ? (
          <Avviso tipo="errore">{testi.chi.errore}</Avviso>
        ) : (
          <PassoChi
            amici={amici.data.amici.map((relazione) => relazione.persona)}
            proposta={proposta}
            selezionati={selezionati}
            onCambia={setSelezionati}
            onContinua={() => setPasso(3)}
          />
        )}
      </Passo>
      <Passo numero={3} titolo={testi.riepilogo.titolo} stato={passo === 3 ? 'ora' : 'dopo'}>
        {scelta && (
          <PassoRiepilogo
            locale={scelta.locale}
            nomi={nomi(selezionati)}
            online={online}
            invio={invio}
            onChiudi={onChiudi}
          />
        )}
      </Passo>
    </div>
  );
}

function Passo({
  numero,
  titolo,
  stato,
  riassunto,
  conteggio,
  onCambia,
  children,
}: {
  numero: number;
  titolo: string;
  stato: 'ora' | 'fatto' | 'dopo';
  riassunto?: string | undefined;
  conteggio?: string | undefined;
  onCambia?: () => void;
  children: ReactNode;
}) {
  return (
    <section
      className={classi('ck-passo', `is-${stato}`)}
      aria-current={stato === 'ora' ? 'step' : undefined}
    >
      <div className="ck-passo-testa">
        <span className="n" aria-hidden="true">
          {numero}
        </span>
        <span className="min-w-0">
          <h3>
            <span className="sr-only">{testi.passo(numero)}: </span>
            {titolo}
          </h3>
          {stato === 'fatto' && riassunto && <small>{riassunto}</small>}
        </span>
        {stato === 'fatto' && onCambia ? (
          <button type="button" className="cambia" onClick={onCambia}>
            {testi.cambia}
            <span className="sr-only"> {titolo}</span>
          </button>
        ) : conteggio ? (
          <span className="ck-mono t-didascalia" aria-hidden="true">
            {conteggio}
          </span>
        ) : null}
      </div>
      {stato === 'ora' && <div className="ck-passo-corpo">{children}</div>}
    </section>
  );
}

function PassoDove({
  scelta,
  onScegli,
  suggerimenti,
  onContinua,
}: {
  scelta: Scelta | null;
  onScegli: (scelta: Scelta | null) => void;
  suggerimenti: ReturnType<typeof useSuggerimenti>;
  onContinua: () => void;
}) {
  const [testo, setTesto] = useState('');
  const risultati = useCercaLocali(testo);
  const eventi = suggerimenti.data?.eventi ?? [];
  const serate = (suggerimenti.data?.serate ?? []).filter((s) => s.locale_id && s.locale);
  const daRicerca = scelta !== null && scelta.chiave === null;
  // Un solo radio nella sequenza del tasto Tab: quello scelto, altrimenti il primo.
  const chiavi = [
    ...eventi.map((evento) => `evento:${evento.evento_id}`),
    ...serate.map((serata) => `serata:${serata.serata_id}`),
  ];
  const conFocus = chiavi.includes(scelta?.chiave ?? '') ? scelta?.chiave : chiavi[0];
  const tabIndice = (chiave: string) => (chiave === conFocus ? 0 : -1);

  return (
    <>
      {eventi.length + serate.length > 0 && (
        <div
          role="radiogroup"
          aria-labelledby="ck-per-stasera"
          onKeyDown={(evento) => {
            // Pattern ARIA del gruppo di radio: le frecce spostano e scelgono.
            const passo =
              evento.key === 'ArrowDown' || evento.key === 'ArrowRight'
                ? 1
                : evento.key === 'ArrowUp' || evento.key === 'ArrowLeft'
                  ? -1
                  : 0;
            if (!passo) return;
            evento.preventDefault();
            const radio = Array.from(
              evento.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]'),
            );
            const attuale = radio.indexOf(document.activeElement as HTMLButtonElement);
            const prossimo = radio[(attuale + passo + radio.length) % radio.length];
            prossimo?.focus();
            prossimo?.click();
          }}
        >
          <h4 className="etichetta m-0" id="ck-per-stasera">
            {testi.dove.perStasera}
          </h4>
          {eventi.map((evento) => {
            const chiave = `evento:${evento.evento_id}`;
            return (
              <button
                key={chiave}
                type="button"
                role="radio"
                aria-checked={scelta?.chiave === chiave}
                tabIndex={tabIndice(chiave)}
                className="ck-sugg"
                onClick={() =>
                  onScegli({
                    localeId: evento.locale_id,
                    locale: evento.locale,
                    dettaglio: `${evento.locale} · ${evento.comune}`,
                    eventoId: evento.evento_id,
                    evento: evento.titolo,
                    chiave,
                  })
                }
              >
                <span className="ck-pin ck-mono t-didascalia">{ora(evento.inizio)}</span>
                <span className="min-w-0">
                  <b>{evento.titolo}</b>
                  <small>
                    {evento.locale} · {evento.comune}
                  </small>
                  <span className="ck-perche">
                    <Icona icona={Check} dimensione="s" />
                    {testi.dove.partecipi}
                  </span>
                </span>
                <span className="ck-radio" aria-hidden="true" />
              </button>
            );
          })}
          {serate.map((serata) => {
            const chiave = `serata:${serata.serata_id}`;
            return (
              <button
                key={chiave}
                type="button"
                role="radio"
                aria-checked={scelta?.chiave === chiave}
                tabIndex={tabIndice(chiave)}
                className="ck-sugg"
                onClick={() =>
                  onScegli({
                    localeId: serata.locale_id!,
                    locale: serata.locale!,
                    dettaglio: `${serata.locale} · ${serata.comune ?? ''}`,
                    eventoId: serata.evento_id,
                    evento: serata.evento,
                    chiave,
                  })
                }
              >
                <span className="ck-pin" aria-hidden="true">
                  <Icona icona={MapPin} />
                </span>
                <span className="min-w-0">
                  <b>{serata.locale}</b>
                  <small>{serata.comune}</small>
                  <span className="ck-perche">
                    <Icona icona={User} dimensione="s" />
                    {testi.dove.serata(serata.titolo)}
                  </span>
                </span>
                <span className="ck-radio" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      )}
      {daRicerca ? (
        <>
          <div className="ck-locale">
            <span className="ck-pin" aria-hidden="true">
              <Icona icona={MapPin} />
            </span>
            <span className="min-w-0">
              <b>{scelta.locale}</b>
              <small>{scelta.dettaglio}</small>
            </span>
            <Pulsante
              variante="testo"
              soloIcona
              aria-label={testi.dove.togli}
              onClick={() => onScegli(null)}
            >
              <Icona icona={X} />
            </Pulsante>
          </div>
          <p className="ck-motivo">
            <Icona icona={Clock} dimensione="s" />
            {testi.dove.senzaEvento}
          </p>
        </>
      ) : (
        <>
          <Campo
            etichetta={testi.dove.cerca}
            type="search"
            placeholder={testi.dove.segnaposto}
            value={testo}
            onChange={(evento) => setTesto(evento.target.value)}
            prefisso={<Icona icona={Search} dimensione="s" />}
            autoComplete="off"
          />
          {testo.trim().length >= 2 && (
            <div aria-live="polite">
              {risultati.isError ? (
                <p className="t-corpo-s c-2 m-0">{testi.dove.cercaErrore}</p>
              ) : risultati.data && risultati.data.length === 0 ? (
                <p className="t-corpo-s c-2 m-0">{testi.dove.nessuno}</p>
              ) : (
                <ul className="m-0 list-none p-0" aria-busy={risultati.isFetching || undefined}>
                  {(risultati.data ?? []).map((locale) => (
                    <li key={locale.id}>
                      <button
                        type="button"
                        className="ck-risultato"
                        onClick={() =>
                          onScegli({
                            localeId: locale.id,
                            locale: locale.nome,
                            dettaglio: `${locale.indirizzo} · ${locale.comune}`,
                            eventoId: null,
                            evento: null,
                            chiave: null,
                          })
                        }
                      >
                        <span className="ck-pin" aria-hidden="true">
                          <Icona icona={MapPin} />
                        </span>
                        <span className="min-w-0">
                          <b>{locale.nome}</b>
                          <small>{locale.comune}</small>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
      <p className="ck-motivo">
        <Icona icona={Lock} dimensione="s" />
        {testi.dove.privacy}
      </p>
      <Pulsante variante="secondario" pieno disabled={!scelta} onClick={onContinua}>
        {testi.continua}
      </Pulsante>
      {!scelta && <p className="sr-only">{testi.dove.scegli}</p>}
    </>
  );
}

function PassoChi({
  amici,
  proposta,
  selezionati,
  onCambia,
  onContinua,
}: {
  amici: Persona[];
  proposta: Proposta | null;
  selezionati: string[];
  onCambia: (selezionati: string[]) => void;
  onContinua: () => void;
}) {
  const [testo, setTesto] = useState('');
  if (amici.length === 0) return <p className="t-corpo-s c-2 m-0">{testi.chi.nessunAmico}</p>;

  const proposti = amici.filter((amico) => proposta?.amici.includes(amico.id));
  const filtro = normalizza(testo.trim().replace(/^@/, ''));
  const altri = amici.filter(
    (amico) =>
      !proposta?.amici.includes(amico.id) &&
      (!filtro ||
        normalizza(amico.nome_visualizzato).includes(filtro) ||
        normalizza(amico.username).includes(filtro)),
  );
  const cambia = (id: string) =>
    onCambia(selezionati.includes(id) ? selezionati.filter((s) => s !== id) : [...selezionati, id]);

  const riga = (amico: Persona) => {
    const scelto = selezionati.includes(amico.id);
    return (
      <li key={amico.id}>
        <button
          type="button"
          role="checkbox"
          className="sel-riga"
          aria-checked={scelto}
          onClick={() => cambia(amico.id)}
        >
          <span className={classi('casella', scelto && 'is-on')} aria-hidden="true">
            {scelto && <Icona icona={Check} dimensione="s" />}
          </span>
          <Avatar nome={amico.nome_visualizzato} foto={amico.avatar_path} decorativo />
          <span className="min-w-0">
            <span className="sel-nome">{amico.nome_visualizzato}</span>
            <span className="sel-username">@{amico.username}</span>
          </span>
        </button>
      </li>
    );
  };

  return (
    <>
      <p className="sr-only" aria-live="polite">
        {testi.chi.selezionati(selezionati.length)}
      </p>
      {proposti.length > 0 && proposta && (
        <>
          <p className="ck-proposti">
            <Icona icona={User} dimensione="s" />
            {testi.chi.dallaSerata(proposta.titolo)}
          </p>
          <ul className="m-0 list-none p-0">{proposti.map(riga)}</ul>
          <h4 className="etichetta ck-altri">{testi.chi.altri}</h4>
        </>
      )}
      <Campo
        etichetta={testi.chi.cerca}
        type="search"
        value={testo}
        onChange={(evento) => setTesto(evento.target.value)}
        prefisso={<Icona icona={Search} dimensione="s" />}
        autoComplete="off"
      />
      {altri.length === 0 && filtro ? (
        <p className="t-corpo-s c-2 m-0">{testi.chi.nessunRisultato}</p>
      ) : (
        <ul className="m-0 list-none p-0">{altri.map(riga)}</ul>
      )}
      <p className="ck-motivo">
        <Icona icona={Lock} dimensione="s" />
        {testi.chi.regola}
      </p>
      <Pulsante
        variante="secondario"
        pieno
        disabled={selezionati.length === 0}
        onClick={onContinua}
      >
        {testi.continua}
      </Pulsante>
    </>
  );
}

function PassoRiepilogo({
  locale,
  nomi,
  online,
  invio,
  onChiudi,
}: {
  locale: string;
  nomi: string[];
  online: boolean;
  invio: { mutate: () => void; isPending: boolean; error: Error | null };
  onChiudi: () => void;
}) {
  const adesso = new Date();
  const fine = new Date(adesso.getTime() + 6 * 60 * 60 * 1000).toISOString();
  const errore = invio.error;
  const codice = errore instanceof ErroreValidazione ? errore.codice : null;
  const reteAssente = !online || errore instanceof ErroreRete;
  const spento = codice === 'checkin_disattivato';
  const testoErrore = reteAssente
    ? testi.errori.rete
    : codice === 'checkin_gia_attivo'
      ? testi.errori.giaAttivo
      : codice === 'troppi_checkin_oggi'
        ? testi.errori.troppi
        : codice === 'locale_non_disponibile'
          ? testi.errori.locale
          : codice === 'checkin_senza_destinatari'
            ? testi.errori.senzaAmici
            : testi.errori.generico;

  return (
    <>
      <div aria-live="assertive">
        {spento ? (
          <Avviso
            tipo="avviso"
            titolo={testi.errori.spento.titolo}
            azioni={
              <Link
                className="btn btn-secondario btn-s"
                href="/profilo/privacy/"
                onClick={onChiudi}
              >
                {testi.errori.spento.azione}
              </Link>
            }
          >
            {testi.errori.spento.testo}
          </Avviso>
        ) : (
          (errore || !online) && (
            <Avviso tipo="errore" titolo={testoErrore.titolo}>
              {testoErrore.testo}
            </Avviso>
          )
        )}
      </div>
      <div className="ck-riepilogo">
        <p>{testi.riepilogo.testo(locale, elencoNomi(nomi), ora(fine))}</p>
        <p className="ck-mono t-didascalia c-2 uppercase">
          {testi.riepilogo.durata(ora(adesso.toISOString()))}
        </p>
      </div>
      <p className="ck-motivo">
        <Icona icona={Clock} dimensione="s" />
        {testi.riepilogo.nota}
      </p>
      <Pulsante
        variante="principale"
        pieno
        disabled={spento || !online}
        caricamento={invio.isPending}
        onClick={() => invio.mutate()}
      >
        {reteAssente && errore ? messaggi.comune.riprova : testi.riepilogo.invia}
      </Pulsante>
    </>
  );
}
