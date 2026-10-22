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
import { useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Icona } from '@/components/ui/Icona';
import { Entra } from '@/components/ui/Movimento';
import { Caricamento, ElencoVuoto, ErroreConAzione } from '@/components/ui/Stati';
import { messaggi } from '@/lib/messaggi/it';
import { segnaLetteTutte, type TipoNotifica } from './api';
import { testoNotifica } from './testo';
import { CHIAVI, useNotifiche } from './dati';

const testi = messaggi.notifiche;

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

const LINK: Record<TipoNotifica, string> = {
  richiesta_amicizia: '/amici/',
  amicizia_accettata: '/amici/',
  invito_gruppo: '/organizza/',
  nuova_serata: '/organizza/',
  aggiornamento_serata: '/organizza/',
  checkin_amico: '/vivi/',
  ritorno_avviato: '/vivi/',
  ritorno_allerta: '/vivi/',
  ritorno_arrivato: '/vivi/',
  esito_moderazione: '/profilo/segnalazioni/',
  rimozione_gruppo: '/organizza/',
  badge_ottenuto: '/ricorda/badge/',
  riepilogo_pronto: '/ricorda/wrapped/',
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
      <ElencoVuoto icona={Bell} titolo={testi.vuoto.titolo}>
        {testi.vuoto.testo}
      </ElencoVuoto>
    );
  }

  const mappa = new Map(notifiche.data.map((n) => [n.id, n]));
  const gruppi = raggruppa(notifiche.data);

  return (
    <Entra>
      <div className="flex flex-col gap-6" role="list" aria-live="polite">
        {gruppi.map((gruppo) => (
          <section key={gruppo.etichetta}>
            <h2 className="etichetta mb-3">{gruppo.etichetta}</h2>
            <ul className="flex flex-col gap-1 list-none p-0 m-0">
              {gruppo.ids.map((id) => {
                const n = mappa.get(id);
                if (!n) return null;
                const IcoComponente = ICONE[n.tipo];
                const href = LINK[n.tipo];
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
    </Entra>
  );
}
