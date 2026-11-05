'use client';

import {
  AlertTriangle,
  Award,
  Bell,
  CalendarClock,
  CalendarPlus,
  Home,
  MapPin,
  Navigation,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Avatar } from '@/components/ui/Avatar';
import { Avviso } from '@/components/ui/Avviso';
import { Icona } from '@/components/ui/Icona';
import { Pulsante } from '@/components/ui/Pulsante';
import { Entra } from '@/components/ui/Movimento';
import { Caricamento, ElencoVuoto, ErroreConAzione } from '@/components/ui/Stati';
import { messaggi } from '@/lib/messaggi/it';
import { ora } from '@/features/scopri/formato';
import { useMontato } from '@/lib/connessione';
import { useCheckinRicevuto } from '@/features/vivi/dati';
import { segnaLetteTutte, type Notifica, type TipoNotifica } from './api';
import { linkNotifica, testoNotifica } from './testo';
import { CHIAVI, useNotifiche } from './dati';
import { FoglioPermesso } from './FoglioPermesso';
import { invitoNascosto, nascondiInvito, useDispositivi, useStatoPush } from './datiPush';

const testi = messaggi.notifiche;
const testiVivi = messaggi.vivi.notifica;

const ICONE: Record<TipoNotifica, LucideIcon> = {
  richiesta_amicizia: UserPlus,
  amicizia_accettata: UserCheck,
  invito_gruppo: Users,
  nuova_serata: CalendarPlus,
  aggiornamento_serata: CalendarClock,
  checkin_amico: MapPin,
  ritorno_avviato: Navigation,
  ritorno_allerta: AlertTriangle,
  ritorno_arrivato: Home,
  esito_moderazione: ShieldCheck,
  rimozione_gruppo: UserMinus,
  badge_ottenuto: Award,
  riepilogo_pronto: Sparkles,
};

function formattaOrario(iso: string): string {
  return new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' }).format(
    new Date(iso),
  );
}

function formattaGiorno(iso: string): string {
  return new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long' }).format(new Date(iso));
}

function inizioGiorno(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

type Gruppo = { etichetta: string; ids: string[] };

function raggruppa(notifiche: { id: string; creata_il: string }[]): Gruppo[] {
  const adesso = new Date();
  const oggiMs = inizioGiorno(adesso);
  const settimanaMs = oggiMs - 6 * 86_400_000;

  const oggi: string[] = [];
  const settimana: string[] = [];
  const prima: string[] = [];

  for (const n of notifiche) {
    const t = inizioGiorno(new Date(n.creata_il));
    if (t >= oggiMs) oggi.push(n.id);
    else if (t >= settimanaMs) settimana.push(n.id);
    else prima.push(n.id);
  }

  const gruppi: Gruppo[] = [];
  if (oggi.length) gruppi.push({ etichetta: testi.gruppi.oggi, ids: oggi });
  if (settimana.length) gruppi.push({ etichetta: testi.gruppi.settimana, ids: settimana });
  if (prima.length) gruppi.push({ etichetta: testi.gruppi.prima, ids: prima });
  return gruppi;
}

/** Elenco delle notifiche raggruppate per periodo; segna tutte come lette all'apertura. */
export function ElencoNotifiche() {
  const notifiche = useNotifiche();
  const client = useQueryClient();
  const segnato = useRef(false);

  const segna = useMutation({
    mutationFn: segnaLetteTutte,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: CHIAVI.notifiche });
    },
  });

  useEffect(() => {
    if (segnato.current) return;
    if (!notifiche.data) return;
    const haNonLette = notifiche.data.some((n) => n.letta_il === null);
    if (!haNonLette) return;
    segnato.current = true;
    segna.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifiche.data]);

  if (notifiche.isPending) {
    return <Caricamento descrizione={testi.caricamento} />;
  }

  if (notifiche.isError) {
    return (
      <ErroreConAzione
        titolo={testi.errore.titolo}
        onRiprova={() => void notifiche.refetch()}
        riprovaInCorso={notifiche.isFetching}
      >
        {testi.errore.testo}
      </ErroreConAzione>
    );
  }

  if (notifiche.data.length === 0) {
    return (
      <>
        <AperturaDaPush notifiche={notifiche.data} />
        <ElencoVuoto icona={Bell} titolo={testi.vuoto.titolo}>
          {testi.vuoto.testo}
        </ElencoVuoto>
        <InvitoPush />
      </>
    );
  }

  const mappa = new Map(notifiche.data.map((n) => [n.id, n]));
  const gruppi = raggruppa(notifiche.data);

  return (
    <Entra>
      <AperturaDaPush notifiche={notifiche.data} />
      <div className="flex flex-col gap-6" role="list" aria-live="polite">
        {gruppi.map((gruppo) => (
          <section key={gruppo.etichetta}>
            <h2 className="etichetta mb-3">{gruppo.etichetta}</h2>
            <ul className="flex flex-col gap-1 list-none p-0 m-0">
              {gruppo.ids.map((id) => {
                const n = mappa.get(id);
                if (!n) return null;
                if (n.tipo === 'checkin_amico') {
                  return (
                    <li key={n.id}>
                      <VoceCheckin notifica={n} />
                    </li>
                  );
                }
                const IcoComponente = ICONE[n.tipo];
                const href = linkNotifica(n.tipo, n.dati);
                const { titolo, motivazione } = testoNotifica(n.tipo, n.dati);
                const nonLetta = n.letta_il === null;
                return (
                  <li key={n.id}>
                    <Link
                      href={href}
                      className="flex items-start gap-3 p-3 rounded-3 hover:bg-superficie-2 transition-colors"
                    >
                      <span
                        className={`cornice-icona mt-0.5 shrink-0 ${nonLetta ? 'bg-accento-tenue' : ''}`}
                        aria-hidden="true"
                      >
                        <Icona
                          icona={IcoComponente}
                          dimensione="s"
                          className={nonLetta ? 'c-accento' : 'c-2'}
                        />
                      </span>
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <p className={`m-0 t-corpo-piccolo ${nonLetta ? 'font-medium' : 'c-2'}`}>
                          {titolo}
                        </p>
                        {motivazione && <p className="m-0 t-didascalia c-2">{motivazione}</p>}
                        <time dateTime={n.creata_il} className="t-didascalia c-3">
                          {inizioGiorno(new Date(n.creata_il)) >= inizioGiorno(new Date())
                            ? formattaOrario(n.creata_il)
                            : formattaGiorno(n.creata_il)}
                        </time>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      <InvitoPush />
    </Entra>
  );
}

function orarioNotifica(iso: string): string {
  return inizioGiorno(new Date(iso)) >= inizioGiorno(new Date())
    ? formattaOrario(iso)
    : formattaGiorno(iso);
}

/**
 * Notifica "check-in di un amico" (design/F-20-checkin §5): nome, username, locale e da
 * quando finché il check-in è attivo; poi "Check-in terminato", senza il locale. I dati si
 * leggono dal check-in con la RLS (R-30, R-17), mai dalla notifica.
 */
function VoceCheckin({ notifica }: { notifica: Notifica }) {
  const id = typeof notifica.dati.checkin_id === 'string' ? notifica.dati.checkin_id : null;
  const checkin = useCheckinRicevuto(id);
  const nonLetta = notifica.letta_il === null;
  const attivo = checkin.data ?? null;
  return (
    <div className="flex items-start gap-3 p-3 rounded-3">
      {attivo ? (
        <Avatar
          nome={attivo.persona.nome_visualizzato}
          foto={attivo.persona.avatar_path}
          decorativo
        />
      ) : (
        <span
          className={`cornice-icona mt-0.5 shrink-0 ${nonLetta ? 'bg-accento-tenue' : ''}`}
          aria-hidden="true"
        >
          <Icona icona={MapPin} dimensione="s" className={nonLetta ? 'c-accento' : 'c-2'} />
        </span>
      )}
      <div className="flex flex-col gap-0.5 min-w-0">
        {attivo ? (
          <>
            <p className={`m-0 t-corpo-piccolo ${nonLetta ? 'font-medium' : ''}`}>
              {testiVivi.titolo(attivo.persona.nome_visualizzato, attivo.locale.nome)}{' '}
              <span className="c-2 ck-mono t-didascalia">@{attivo.persona.username}</span>
            </p>
            <span className="nt-ck">{testiVivi.dalle(ora(attivo.creatoIl))}</span>
            {attivo.evento && (
              <Link
                className="btn btn-secondario btn-s self-start mt-1"
                href={`/evento/?id=${attivo.evento.id}`}
              >
                {testiVivi.vediLocale}
              </Link>
            )}
          </>
        ) : (
          <>
            <p className="m-0 t-corpo-piccolo c-2">
              {checkin.isPending ? testi.tipi.checkin_amico : testiVivi.terminato}
            </p>
            {!checkin.isPending && (
              <p className="m-0 t-didascalia c-2">{testiVivi.terminatoTesto}</p>
            )}
          </>
        )}
        <time dateTime={notifica.creata_il} className="t-didascalia c-3">
          {orarioNotifica(notifica.creata_il)}
        </time>
      </div>
    </div>
  );
}

/**
 * Tocco su una notifica del telefono (`/notifiche/?apri=<id>`): porta alla schermata giusta,
 * oppure resta qui con "Non è più disponibile" se nel frattempo l'oggetto non c'è più
 * (amicizia annullata, check-in terminato, persona bloccata).
 */
function AperturaDaPush({ notifiche }: { notifiche: Notifica[] }) {
  const parametri = useSearchParams();
  const router = useRouter();
  const apri = parametri.get('apri');
  const notifica = apri ? notifiche.find((n) => n.id === apri) : undefined;
  const idCheckin =
    notifica?.tipo === 'checkin_amico' && typeof notifica.dati.checkin_id === 'string'
      ? notifica.dati.checkin_id
      : null;
  const checkin = useCheckinRicevuto(idCheckin);
  const gestita = useRef<string | null>(null);

  useEffect(() => {
    if (!apri || !notifica || gestita.current === apri) return;
    if (notifica.tipo !== 'checkin_amico') {
      gestita.current = apri;
      router.replace(linkNotifica(notifica.tipo, notifica.dati));
    } else if (checkin.data) {
      gestita.current = apri;
      router.replace(checkin.data.evento ? `/evento/?id=${checkin.data.evento.id}` : '/vivi/');
    }
  }, [apri, notifica, checkin.data, router]);

  const nonDisponibile =
    apri !== null &&
    (!notifica || (notifica.tipo === 'checkin_amico' && !checkin.isPending && !checkin.data));
  if (!nonDisponibile) return null;
  return (
    <div className="mb-4" aria-live="polite">
      <Avviso tipo="info">{messaggi.push.elenco.nonDisponibile}</Avviso>
    </div>
  );
}

/**
 * Riga discreta in fondo all'elenco (design/F-22-notifiche §4): solo se le notifiche sul
 * telefono sono spente qui e si possono chiedere; "Non mostrare più" la nasconde per sempre.
 */
function InvitoPush() {
  const stato = useStatoPush();
  const dispositivi = useDispositivi();
  const montato = useMontato();
  const [nascostoOra, setNascosto] = useState(false);
  const [foglio, setFoglio] = useState(false);
  // La scelta "Non mostrare più" sta nel browser: si legge solo dopo l'idratazione.
  const nascosto = !montato || nascostoOra || invitoNascosto();

  const accesoQui = (dispositivi.data ?? []).some((d) => d.questo);
  if (nascosto || stato !== 'da_chiedere' || dispositivi.isPending || accesoQui) return null;
  return (
    <div className="nf-invito">
      <p>{messaggi.push.elenco.invito}</p>
      <div className="az">
        <Pulsante variante="testo" dimensione="s" onClick={() => setFoglio(true)}>
          {messaggi.push.elenco.attiva}
        </Pulsante>
        <Pulsante
          variante="testo"
          dimensione="s"
          onClick={() => {
            nascondiInvito();
            setNascosto(true);
          }}
        >
          {messaggi.push.elenco.nascondi}
        </Pulsante>
      </div>
      <FoglioPermesso aperto={foglio} onChiudi={() => setFoglio(false)} />
    </div>
  );
}
