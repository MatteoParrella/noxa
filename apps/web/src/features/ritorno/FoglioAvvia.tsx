'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import {
  ArrowRight,
  Check,
  Clock,
  Info,
  Lock,
  MapPin,
  Search,
  Smartphone,
  Trash2,
  User,
  LocateOff,
} from 'lucide-react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Avviso } from '@/components/ui/Avviso';
import { Campo } from '@/components/ui/Campo';
import { Foglio } from '@/components/ui/Foglio';
import { Icona } from '@/components/ui/Icona';
import { Pillole } from '@/components/ui/Pillole';
import { Pulsante } from '@/components/ui/Pulsante';
import { Caricamento } from '@/components/ui/Stati';
import { useToast } from '@/components/ui/Toast';
import { useAmici } from '@/features/amici/dati';
import { classi } from '@/lib/classi';
import { useOnline } from '@/lib/connessione';
import { ErroreRete, ErroreValidazione } from '@/lib/errori';
import { messaggi } from '@/lib/messaggi/it';
import { elencoNomi } from '@/lib/messaggi/vivi';
import { registraErrore } from '@/lib/registro';
import { avviaRitorno, inviaPosizione, type Coordinate, type Persona } from './api';
import { NotaPwa } from './Componenti';
import { CHIAVI_RITORNO, useAreeArrivo, useSuggerimentiRitorno } from './dati';
import { salvaSessioneLocale } from './dispositivo';
import { metri, oraDi, useAdesso } from './formato';
import { aggiornaMotore, azzeraMotore, PRECISIONE_SCARSA } from './motore';
import {
  apriImpostazioni,
  ErroreDiPosizione,
  modoPosizione,
  permessoPosizione,
  posizioneAttuale,
  type ErrorePosizione,
} from './posizione';

const testi = messaggi.ritorno.avvia;
const tp = messaggi.ritorno.permessi;

const MINIMO = 10 * 60_000;
const MASSIMO = 4 * 60 * 60_000;
const MASSIMO_AMICI = 5;
const CHIAVE_SPIEGATA = 'noxa-posizione-spiegata';

type Scorciatoia = '30' | '60' | '90';

const normalizza = (testo: string) =>
  testo.toLocaleLowerCase('it').normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Prossima occorrenza di un orario "HH:MM" (oggi o domani). */
export function prossimoOrario(valore: string, adesso: number): number | null {
  const parti = /^(\d{2}):(\d{2})$/.exec(valore);
  if (!parti) return null;
  const ore = Number(parti[1]);
  const minuti = Number(parti[2]);
  if (ore > 23 || minuti > 59) return null;
  const data = new Date(adesso);
  data.setHours(ore, minuti, 0, 0);
  if (data.getTime() <= adesso) data.setDate(data.getDate() + 1);
  return data.getTime();
}

/** L'arrivo previsto è tra 10 minuti e 4 ore da adesso (R-31, con un margine per la rete). */
export function arrivoValido(arrivo: number | null, adesso: number): boolean {
  return (
    arrivo !== null && arrivo >= adesso + MINIMO + 30_000 && arrivo <= adesso + MASSIMO - 30_000
  );
}

/**
 * Avvia il ritorno, apre la sessione su questo telefono (tratta e area restano qui, R-32) e
 * invia subito la prima posizione.
 */
async function avviaECondividi(dati: {
  arrivo: number;
  destinatari: string[];
  coordinate: Coordinate;
  partenza: string | null;
  areaId: string | null;
}) {
  const esito = await avviaRitorno({
    arrivoPrevisto: new Date(dati.arrivo),
    destinatari: dati.destinatari,
  });
  salvaSessioneLocale({ ritornoId: esito.id, partenza: dati.partenza, areaId: dati.areaId });
  azzeraMotore(esito.id);
  aggiornaMotore({ ultima: { ...dati.coordinate, il: Date.now() } });
  try {
    await inviaPosizione(esito.id, dati.coordinate, modoPosizione() === 'nativo');
    aggiornaMotore({ inviataIl: Date.now() });
  } catch (errore) {
    // Il ritorno è partito: la posizione riparte con il prossimo aggiornamento.
    if (!(errore instanceof ErroreRete)) registraErrore('prima posizione del ritorno', errore);
  }
  return esito;
}

function spiegata(): boolean {
  try {
    return window.localStorage.getItem(CHIAVE_SPIEGATA) === '1';
  } catch {
    return false;
  }
}

function segnaSpiegata(): void {
  try {
    window.localStorage.setItem(CHIAVE_SPIEGATA, '1');
  } catch {
    // Senza storage la spiegazione si ripete: nessun danno.
  }
}

/**
 * Foglio "Avvia il ritorno sicuro" (design/F-21-ritorno-sicuro §2, §3): arrivo previsto, chi
 * lo vede (da 1 a 5 amici confermati), area di arrivo facoltativa salvata solo sul telefono,
 * riepilogo con l'allerta del server detta prima. La posizione si chiede solo dopo "Avvia".
 */
export function FoglioAvvia({ aperto, onChiudi }: { aperto: boolean; onChiudi: () => void }) {
  return (
    <Foglio aperto={aperto} onChiudi={onChiudi} titolo={testi.titolo}>
      {aperto && <Contenuto onChiudi={onChiudi} />}
    </Foglio>
  );
}

type Fase =
  | { tipo: 'passi' }
  | { tipo: 'spiegazione' }
  | { tipo: 'cerco' }
  | { tipo: 'errore_posizione'; motivo: ErrorePosizione }
  | { tipo: 'imprecisa'; coordinate: Coordinate }
  | { tipo: 'esito'; esclusi: string[]; inviati: number };

function Contenuto({ onChiudi }: { onChiudi: () => void }) {
  const client = useQueryClient();
  const mostraToast = useToast();
  const online = useOnline();
  const amici = useAmici();
  const suggerimenti = useSuggerimentiRitorno(true);
  const aree = useAreeArrivo();
  const adesso = useAdesso(15_000);
  const [passo, setPasso] = useState<1 | 2 | 3 | 4>(1);
  const [fase, setFase] = useState<Fase>({ tipo: 'passi' });
  const [scorciatoia, setScorciatoia] = useState<Scorciatoia | null>('60');
  const [orario, setOrario] = useState('');
  const [selezionati, setSelezionati] = useState<string[] | null>(null);
  const [areaId, setAreaId] = useState<string | null>(null);

  const persone = new Map<string, Persona>(
    (amici.data?.amici ?? []).map((relazione) => [relazione.persona.id, relazione.persona]),
  );
  const nomi = (ids: readonly string[]) =>
    ids.flatMap((id) => {
      const persona = persone.get(id);
      return persona ? [persona.nome_visualizzato] : [];
    });

  const serata = suggerimenti.data?.serate.find((s) => s.amici.length > 0) ?? null;
  const proposti = (serata?.amici ?? []).filter((id) => persone.has(id));
  const tornaConTe = new Set((serata?.torna_con_te ?? []).filter((id) => persone.has(id)));
  // Chi torna con te arriva già spuntato, una volta (si può togliere).
  const scelti = selezionati ?? [...tornaConTe].slice(0, MASSIMO_AMICI);

  const arrivo =
    orario !== ''
      ? prossimoOrario(orario, adesso)
      : scorciatoia
        ? adesso + Number(scorciatoia) * 60_000
        : null;
  const arrivoOk = arrivoValido(arrivo, adesso);

  const avvio = useMutation({
    mutationFn: (coordinate: Coordinate) =>
      avviaECondividi({
        arrivo: arrivo!,
        destinatari: scelti,
        coordinate,
        partenza: suggerimenti.data?.partenza ?? serata?.locale ?? null,
        areaId,
      }),
    onSuccess: (esito) => {
      void client.invalidateQueries({ queryKey: CHIAVI_RITORNO.tutti });
      mostraToast({ testo: testi.fatto(esito.destinatari.length) });
      if (esito.esclusi.length > 0)
        setFase({ tipo: 'esito', esclusi: esito.esclusi, inviati: esito.destinatari.length });
      else onChiudi();
    },
    onError: (errore) => {
      setFase({ tipo: 'passi' });
      if (!(errore instanceof ErroreValidazione) && !(errore instanceof ErroreRete))
        registraErrore('avvio del ritorno', errore);
    },
  });

  async function cercaPosizione() {
    setFase({ tipo: 'cerco' });
    if (Capacitor.isNativePlatform()) {
      // Android 13+: senza il permesso delle notifiche la notifica fissa non compare (R-31).
      await PushNotifications.requestPermissions().catch(() => undefined);
    }
    try {
      const coordinate = await posizioneAttuale();
      if (coordinate.precisione > PRECISIONE_SCARSA) setFase({ tipo: 'imprecisa', coordinate });
      else avvio.mutate(coordinate);
    } catch (errore) {
      setFase({
        tipo: 'errore_posizione',
        motivo: errore instanceof ErroreDiPosizione ? errore.motivo : 'spenta',
      });
    }
  }

  async function avvia() {
    const permesso = await permessoPosizione();
    if (permesso !== 'concesso' && !spiegata()) {
      setFase({ tipo: 'spiegazione' });
      return;
    }
    void cercaPosizione();
  }

  if (fase.tipo === 'spiegazione') {
    return (
      <Spiegazione
        onNonOra={onChiudi}
        onContinua={() => {
          segnaSpiegata();
          void cercaPosizione();
        }}
      />
    );
  }
  if (fase.tipo === 'cerco' || avvio.isPending) {
    return <Caricamento descrizione={tp.attesa} righe={2} />;
  }
  if (fase.tipo === 'errore_posizione') {
    return (
      <ErrorePosizioneVista
        motivo={fase.motivo}
        onRiprova={() => void cercaPosizione()}
        onChiudi={onChiudi}
      />
    );
  }
  if (fase.tipo === 'imprecisa') {
    return (
      <div className="flex flex-col gap-4">
        <Avviso tipo="avviso" titolo={tp.imprecisa.titolo(metri(fase.coordinate.precisione))}>
          {tp.imprecisa.testo}
        </Avviso>
        <Pulsante variante="principale" pieno onClick={() => avvio.mutate(fase.coordinate)}>
          {tp.imprecisa.avvia}
        </Pulsante>
        <Pulsante variante="secondario" pieno onClick={() => void cercaPosizione()}>
          {tp.spenta.riprova}
        </Pulsante>
      </div>
    );
  }
  if (fase.tipo === 'esito') {
    return (
      <div className="flex flex-col gap-4" aria-live="polite">
        <Avviso tipo="successo">{testi.fatto(fase.inviati)}</Avviso>
        <Avviso tipo="info" titolo={testi.esclusi.titolo(elencoNomi(nomi(fase.esclusi)))}>
          {testi.esclusi.testo}
        </Avviso>
        <Pulsante variante="principale" pieno onClick={onChiudi}>
          {messaggi.push.foglio.attive.fatto}
        </Pulsante>
      </div>
    );
  }

  const tra = arrivo ? Math.round((arrivo - adesso) / 60_000) : 0;
  return (
    <div className="flex flex-col">
      <Passo
        numero={1}
        titolo={testi.arrivo.titolo}
        stato={passo === 1 ? 'ora' : 'fatto'}
        riassunto={
          arrivo
            ? testi.arrivo.riassunto(oraDi(arrivo), messaggi.ritorno.tempo.tra(tra))
            : undefined
        }
        onCambia={() => setPasso(1)}
      >
        <div className="rt-scorciatoie">
          <Pillole<Scorciatoia>
            etichetta={testi.arrivo.scorciatoie}
            opzioni={[
              { valore: '30', etichetta: testi.arrivo.min30 },
              { valore: '60', etichetta: testi.arrivo.ora1 },
              { valore: '90', etichetta: testi.arrivo.ora1e30 },
            ]}
            valore={orario === '' ? scorciatoia : null}
            onCambia={(valore) => {
              setScorciatoia(valore);
              setOrario('');
            }}
          />
        </div>
        <Campo
          etichetta={testi.arrivo.orario}
          type="time"
          value={orario}
          onChange={(evento) => {
            setOrario(evento.target.value);
            setScorciatoia(null);
          }}
          prefisso={<Icona icona={Clock} dimensione="s" />}
          errore={orario !== '' && !arrivoOk ? testi.arrivo.fuori : undefined}
        />
        <div className="rt-ora" aria-live="polite">
          <span>{testi.arrivo.previstoAlle}</span>
          <b>{arrivo && arrivoOk ? oraDi(arrivo) : '—'}</b>
        </div>
        <p className="rt-limiti m-0">
          {testi.arrivo.limiti(oraDi(adesso + MINIMO), oraDi(adesso + MASSIMO))}
        </p>
        <Pulsante variante="secondario" pieno disabled={!arrivoOk} onClick={() => setPasso(2)}>
          {testi.continua}
        </Pulsante>
      </Passo>
      <Passo
        numero={2}
        titolo={testi.chi.titolo}
        stato={passo === 2 ? 'ora' : passo > 2 ? 'fatto' : 'dopo'}
        riassunto={passo > 2 ? elencoNomi(nomi(scelti)) : undefined}
        conteggio={passo === 2 ? testi.chi.conteggio(scelti.length) : undefined}
        onCambia={() => setPasso(2)}
      >
        {amici.isPending ? (
          <Caricamento descrizione={testi.chi.caricamento} righe={3} />
        ) : amici.isError ? (
          <Avviso tipo="errore">{testi.chi.errore}</Avviso>
        ) : (
          <PassoChi
            amici={amici.data.amici.map((relazione) => relazione.persona)}
            proposti={proposti}
            tornaConTe={tornaConTe}
            serata={serata?.titolo ?? null}
            selezionati={scelti}
            onCambia={setSelezionati}
            onContinua={() => setPasso(3)}
          />
        )}
      </Passo>
      <Passo
        numero={3}
        titolo={testi.area.titolo}
        stato={passo === 3 ? 'ora' : passo > 3 ? 'fatto' : 'dopo'}
        riassunto={
          passo > 3 ? (aree.find((a) => a.id === areaId)?.nome ?? testi.area.nessuna) : undefined
        }
        conteggio={passo === 3 ? testi.area.facoltativa : undefined}
        onCambia={() => setPasso(3)}
      >
        <div role="radiogroup" aria-label={testi.area.titolo} className="flex flex-col">
          <OpzioneArea
            scelta={areaId === null}
            titolo={testi.area.nessuna}
            testo={testi.area.nessunaTesto}
            onScegli={() => setAreaId(null)}
          />
          {aree.map((area) => (
            <OpzioneArea
              key={area.id}
              scelta={areaId === area.id}
              titolo={area.nome}
              testo={testi.area.dettaglio(area.raggio)}
              onScegli={() => setAreaId(area.id)}
            />
          ))}
        </div>
        {aree.length === 0 && <p className="ck-motivo">{testi.area.vuoto}</p>}
        <Pulsante variante="secondario" pieno onClick={() => setPasso(4)}>
          {testi.continua}
        </Pulsante>
      </Passo>
      <Passo numero={4} titolo={testi.riepilogo.titolo} stato={passo === 4 ? 'ora' : 'dopo'}>
        <Riepilogo
          nomi={nomi(scelti)}
          arrivo={arrivo}
          online={online}
          errore={avvio.error}
          pronto={arrivoOk && scelti.length > 0}
          onAvvia={() => void avvia()}
        />
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

function PassoChi({
  amici,
  proposti,
  tornaConTe,
  serata,
  selezionati,
  onCambia,
  onContinua,
}: {
  amici: Persona[];
  proposti: string[];
  tornaConTe: Set<string>;
  serata: string | null;
  selezionati: string[];
  onCambia: (selezionati: string[]) => void;
  onContinua: () => void;
}) {
  const [testo, setTesto] = useState('');
  if (amici.length === 0) return <p className="t-corpo-s c-2 m-0">{testi.chi.nessunAmico}</p>;

  const pieno = selezionati.length >= MASSIMO_AMICI;
  const inCima = amici.filter((amico) => proposti.includes(amico.id));
  const filtro = normalizza(testo.trim().replace(/^@/, ''));
  const altri = amici.filter(
    (amico) =>
      !proposti.includes(amico.id) &&
      (!filtro ||
        normalizza(amico.nome_visualizzato).includes(filtro) ||
        normalizza(amico.username).includes(filtro)),
  );
  const cambia = (id: string) =>
    onCambia(selezionati.includes(id) ? selezionati.filter((s) => s !== id) : [...selezionati, id]);

  const riga = (amico: Persona) => {
    const scelto = selezionati.includes(amico.id);
    const spento = pieno && !scelto;
    const idMotivo = `rt-limite-${amico.id}`;
    return (
      <li key={amico.id}>
        <button
          type="button"
          role="checkbox"
          className="sel-riga"
          aria-checked={scelto}
          aria-disabled={spento || undefined}
          aria-describedby={spento ? idMotivo : undefined}
          onClick={() => {
            if (!spento) cambia(amico.id);
          }}
        >
          <span className={classi('casella', scelto && 'is-on')} aria-hidden="true">
            {scelto && <Icona icona={Check} dimensione="s" />}
          </span>
          <Avatar nome={amico.nome_visualizzato} foto={amico.avatar_path} decorativo />
          <span className="min-w-0">
            <span className="sel-nome">{amico.nome_visualizzato}</span>
            <span className="sel-username">@{amico.username}</span>
            {tornaConTe.has(amico.id) && (
              <span className="rt-tag">
                <Icona icona={ArrowRight} dimensione="s" />
                {testi.chi.tornaConTe}
              </span>
            )}
            {spento && (
              <span className="ck-motivo" id={idMotivo}>
                <Icona icona={Info} dimensione="s" />
                {testi.chi.limite}
              </span>
            )}
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
      {inCima.length > 0 && serata && (
        <>
          <p className="ck-proposti">
            <Icona icona={User} dimensione="s" />
            {testi.chi.dallaSerata(serata)}
          </p>
          <ul className="m-0 list-none p-0">{inCima.map(riga)}</ul>
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

function OpzioneArea({
  scelta,
  titolo,
  testo,
  onScegli,
}: {
  scelta: boolean;
  titolo: string;
  testo: string;
  onScegli: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={scelta}
      className="rt-area-opz"
      onClick={onScegli}
      onKeyDown={(evento) => {
        const passo =
          evento.key === 'ArrowDown' || evento.key === 'ArrowRight'
            ? 1
            : evento.key === 'ArrowUp' || evento.key === 'ArrowLeft'
              ? -1
              : 0;
        if (!passo) return;
        evento.preventDefault();
        const gruppo = evento.currentTarget.parentElement;
        const radio = Array.from(
          gruppo?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? [],
        );
        const prossimo =
          radio[(radio.indexOf(evento.currentTarget) + passo + radio.length) % radio.length];
        prossimo?.focus();
        prossimo?.click();
      }}
      tabIndex={scelta ? 0 : -1}
    >
      <span className="ck-radio" aria-hidden="true" />
      <span className="min-w-0">
        <b>{titolo}</b>
        <small>{testo}</small>
      </span>
    </button>
  );
}

function Riepilogo({
  nomi,
  arrivo,
  online,
  errore,
  pronto,
  onAvvia,
}: {
  nomi: string[];
  arrivo: number | null;
  online: boolean;
  errore: Error | null;
  pronto: boolean;
  onAvvia: () => void;
}) {
  const codice = errore instanceof ErroreValidazione ? errore.codice : null;
  const reteAssente = !online || errore instanceof ErroreRete;
  const testoErrore = reteAssente
    ? testi.errori.rete
    : codice === 'ritorno_gia_attivo'
      ? testi.errori.giaAttivo
      : codice === 'troppi_ritorni_oggi'
        ? testi.errori.troppi
        : codice === 'arrivo_fuori_limiti'
          ? testi.errori.arrivo
          : codice === 'ritorno_senza_destinatari' || codice === 'ritorno_troppi_destinatari'
            ? testi.errori.senzaAmici
            : testi.errori.generico;
  const oraArrivo = arrivo ? oraDi(arrivo) : '—';
  return (
    <>
      <div aria-live="assertive">
        {(errore || !online) && (
          <Avviso tipo="errore" titolo={testoErrore.titolo}>
            {testoErrore.testo}
          </Avviso>
        )}
      </div>
      <ul className="rt-tre">
        <li>
          <Icona icona={MapPin} dimensione="s" className="ico" />
          <span>
            {nomi.length === 1
              ? testi.riepilogo.chiUno(nomi[0] ?? '')
              : testi.riepilogo.chi(elencoNomi(nomi))}
          </span>
        </li>
        <li>
          <Icona icona={Clock} dimensione="s" className="ico" />
          <span>{testi.riepilogo.allerta(oraArrivo)}</span>
        </li>
        <li>
          <Icona icona={Trash2} dimensione="s" className="ico" />
          <span>{testi.riepilogo.cancella}</span>
        </li>
      </ul>
      <NotaPwa />
      <Pulsante variante="principale" pieno disabled={!online || !pronto} onClick={onAvvia}>
        {reteAssente && errore ? messaggi.comune.riprova : testi.riepilogo.avvia}
      </Pulsante>
    </>
  );
}

function Spiegazione({ onNonOra, onContinua }: { onNonOra: () => void; onContinua: () => void }) {
  const icone = [MapPin, Clock, User, Trash2] as const;
  const t = tp.spiegazione;
  return (
    <div className="rt-permessi">
      <h2>{t.titolo}</h2>
      <p>{t.testo}</p>
      <ul className="rt-tre">
        {t.punti.map((punto, indice) => (
          <li key={punto.titolo}>
            <Icona icona={icone[indice] ?? MapPin} dimensione="s" className="ico" />
            <span>
              <b>{punto.titolo}</b>
              <br />
              {punto.testo}
            </span>
          </li>
        ))}
      </ul>
      {modoPosizione() === 'nativo' ? (
        <p className="rt-pwa m-0">
          <Icona icona={Smartphone} dimensione="s" className="ico" />
          <span>
            <b>{t.android.titolo}</b> {t.android.testo}
          </span>
        </p>
      ) : (
        <NotaPwa />
      )}
      <div className="rt-due">
        <Pulsante variante="secondario" pieno onClick={onNonOra}>
          {t.nonOra}
        </Pulsante>
        <Pulsante variante="principale" pieno onClick={onContinua}>
          {t.continua}
        </Pulsante>
      </div>
    </div>
  );
}

function Percorso({ voci }: { voci: readonly string[] }) {
  return (
    <ol className="rt-percorso">
      {voci.map((voce, indice) => (
        <li key={voce}>
          <code>{voce}</code>
          {indice < voci.length - 1 && <span aria-hidden="true">→</span>}
        </li>
      ))}
    </ol>
  );
}

function ErrorePosizioneVista({
  motivo,
  onRiprova,
  onChiudi,
}: {
  motivo: ErrorePosizione;
  onRiprova: () => void;
  onChiudi: () => void;
}) {
  const nativo = modoPosizione() === 'nativo';
  if (motivo === 'negata') {
    return (
      <div className="rt-permessi" aria-live="assertive">
        <h2>{tp.negata.titolo}</h2>
        <p>{tp.negata.testo}</p>
        <Avviso tipo="avviso" titolo={tp.negata.avviso}>
          <span className="flex flex-col gap-2">
            {tp.negata.avvisoTesto}
            <Percorso voci={nativo ? tp.negata.percorsoApp : tp.negata.percorsoBrowser} />
          </span>
        </Avviso>
        {nativo && (
          <Pulsante variante="secondario" pieno onClick={apriImpostazioni}>
            {tp.negata.apriImpostazioni}
          </Pulsante>
        )}
        <Link className="btn btn-secondario btn-pieno" href="/vivi/" onClick={onChiudi}>
          {tp.negata.torna}
        </Link>
      </div>
    );
  }
  return (
    <div className="rt-permessi" aria-live="assertive">
      <h2>{tp.spenta.titolo}</h2>
      <p>{tp.spenta.testo}</p>
      <Avviso tipo="avviso" titolo={tp.spenta.avviso}>
        <span className="flex flex-col gap-2">
          <span className="inline-flex items-center gap-2">
            <Icona icona={LocateOff} dimensione="s" />
            {tp.spenta.avvisoTesto}
          </span>
          <Percorso voci={tp.spenta.percorso} />
        </span>
      </Avviso>
      <Pulsante variante="secondario" pieno onClick={onRiprova}>
        {tp.spenta.riprova}
      </Pulsante>
    </div>
  );
}
