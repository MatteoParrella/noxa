'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CalendarDays,
  Copy,
  Flag,
  Image as IconaImmagine,
  LogOut,
  Menu,
  MessageSquare,
  Rss,
  Store,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Contatore } from '@/components/ui/Badge';
import { Icona } from '@/components/ui/Icona';
import { Pulsante } from '@/components/ui/Pulsante';
import { Caricamento, ErroreConAzione, StrisciaOffline } from '@/components/ui/Stati';
import { esci } from '@/features/account/api';
import { ricordaPaginaDopoAccesso } from '@/features/account/dopoAccesso';
import { PERCORSI } from '@/features/account/documenti';
import { useSessione } from '@/features/account/sessione';
import { useMioAvatar } from '@/features/amici/dati';
import { useOnline } from '@/lib/connessione';
import { messaggi } from '@/lib/messaggi/it';
import { AttivaDueFattori, InserisciCodice, SenzaRuolo, SenzaSessione } from './AccessoDueFattori';
import { DURATA_ACCESSO_MS, leggiMieiRuoli, leggiMioNome, leggiStatoDueFattori } from './api';
import { CHIAVI, useContatori } from './dati';

const testi = messaggi.moderazione;

export const PERCORSI_MODERAZIONE = {
  locali: '/moderazione/locali/',
  candidati: '/moderazione/locali/?vista=candidati',
  locale: (id: string) => `/moderazione/locale/?id=${id}`,
  nuovoLocale: '/moderazione/locale/',
  fonti: '/moderazione/fonti/',
  fonte: (id: string) => `/moderazione/fonte/?id=${id}`,
  nuovaFonte: (locale?: string) => `/moderazione/fonte/${locale ? `?locale=${locale}` : ''}`,
  duplicati: '/moderazione/duplicati/',
  eventi: '/moderazione/eventi/',
  annullamenti: '/moderazione/eventi/?vista=annullamenti',
  evento: (id: string) => `/moderazione/evento/?id=${id}`,
  flyer: '/moderazione/flyer/',
  segnalazioni: '/moderazione/segnalazioni/',
  segnalazione: (id: string) => `/moderazione/segnalazione/?id=${id}`,
  reclami: '/moderazione/reclami/',
} as const;

const CHIAVE_DUE_FATTORI = ['moderazione', 'due-fattori'] as const;

/**
 * Accesso all'area di moderazione: account con ruolo di moderatore e due fattori (R-06).
 * Il controllo qui serve all'esperienza d'uso: senza `aal2` la RLS e le RPC non restituiscono
 * nulla (private.e_moderatore).
 */
export function GuscioModerazione({ children }: { children: ReactNode }) {
  const sessione = useSessione();
  const client = useQueryClient();
  const utenteId = sessione.stato === 'presente' ? sessione.utenteId : null;
  const ruoli = useQuery({
    queryKey: ['moderazione', 'ruoli', utenteId],
    queryFn: () => leggiMieiRuoli(utenteId as string),
    enabled: utenteId !== null,
  });
  const moderatore = (ruoli.data ?? []).length > 0;
  const dueFattori = useQuery({
    queryKey: [...CHIAVE_DUE_FATTORI, utenteId],
    queryFn: leggiStatoDueFattori,
    enabled: moderatore,
  });

  // Dopo 8 ore dal codice l'accesso all'area scade e il codice si chiede di nuovo.
  const verificatoIl =
    dueFattori.data && dueFattori.data.stato !== 'da_attivare'
      ? dueFattori.data.verificatoIl
      : null;
  useEffect(() => {
    if (verificatoIl === null) return;
    const attesa = verificatoIl + DURATA_ACCESSO_MS - Date.now();
    if (attesa <= 0) return;
    const timer = window.setTimeout(
      () => void client.invalidateQueries({ queryKey: CHIAVE_DUE_FATTORI }),
      Math.min(attesa, 2 ** 31 - 1),
    );
    return () => window.clearTimeout(timer);
  }, [verificatoIl, client]);

  useEffect(() => {
    if (sessione.stato === 'assente') {
      ricordaPaginaDopoAccesso(window.location.pathname + window.location.search);
    }
  }, [sessione.stato]);

  const verificato = () => {
    // Con il nuovo livello di accesso i dati dell'area vanno riletti.
    void client.invalidateQueries({ queryKey: CHIAVI.tutto });
  };

  if (sessione.stato === 'assente') return <SenzaSessione />;
  if (sessione.stato === 'caricamento' || ruoli.isPending || (moderatore && dueFattori.isPending)) {
    return (
      <main className="porta" id="contenuto">
        <Caricamento descrizione={testi.accesso.caricamento} />
      </main>
    );
  }
  if (ruoli.isError || dueFattori.isError) {
    return (
      <main className="porta" id="contenuto">
        <ErroreConAzione
          titolo={messaggi.comune.erroreRete.titolo}
          onRiprova={() => {
            void ruoli.refetch();
            void dueFattori.refetch();
          }}
          riprovaInCorso={ruoli.isFetching || dueFattori.isFetching}
        >
          {messaggi.comune.erroreRete.testo}
        </ErroreConAzione>
      </main>
    );
  }
  if (!moderatore) return <SenzaRuolo />;

  const stato = dueFattori.data;
  if (!stato || stato.stato === 'da_attivare') return <AttivaDueFattori onAttivato={verificato} />;
  if (stato.stato === 'da_verificare') {
    return (
      <InserisciCodice
        fattoreId={stato.fattoreId}
        scaduta={stato.verificatoIl !== null}
        onVerificato={verificato}
      />
    );
  }
  return <Area utenteId={utenteId as string}>{children}</Area>;
}

function Area({ utenteId, children }: { utenteId: string; children: ReactNode }) {
  const online = useOnline();
  const percorso = usePathname();
  // Il menu a 390 px resta aperto solo sulla pagina in cui lo si è aperto.
  const [apertoSu, setApertoSu] = useState<string | null>(null);
  const menuAperto = apertoSu === percorso;

  return (
    <div className="md">
      <a className="salta-al-contenuto" href="#contenuto">
        {testi.comune.saltaAlContenuto}
      </a>
      <div className="md-guscio">
        <div className="md-barra-mobile">
          <b>noxa</b>
          <span className="etichetta">{testi.marchio}</span>
          <Pulsante
            className="ml-auto"
            variante="neutro"
            soloIcona
            aria-label={menuAperto ? testi.navigazione.chiudiMenu : testi.navigazione.apriMenu}
            aria-expanded={menuAperto}
            aria-controls="md-lato"
            onClick={() => setApertoSu(menuAperto ? null : percorso)}
          >
            <Icona icona={menuAperto ? X : Menu} />
          </Pulsante>
        </div>
        <NavigazioneLaterale utenteId={utenteId} aperta={menuAperto} />
        <main className="md-main" id="contenuto" tabIndex={-1}>
          {!online && <StrisciaOffline testo={testi.comune.offline} />}
          {children}
        </main>
      </div>
    </div>
  );
}

function VoceNavigazione({
  href,
  icona,
  etichetta,
  attiva,
  contatore,
}: {
  href: string;
  icona: typeof Store;
  etichetta: string;
  attiva: boolean;
  contatore?: ReactNode;
}) {
  return (
    <Link className="md-voce" href={href} aria-current={attiva ? 'page' : undefined}>
      <Icona icona={icona} dimensione="s" />
      {etichetta}
      {contatore}
    </Link>
  );
}

function NavigazioneLaterale({ utenteId, aperta }: { utenteId: string; aperta: boolean }) {
  const percorso = usePathname();
  const router = useRouter();
  const client = useQueryClient();
  const contatori = useContatori();
  const mioAvatar = useMioAvatar();
  const nome = useQuery({
    queryKey: ['moderazione', 'nome', utenteId],
    queryFn: () => leggiMioNome(utenteId),
  });
  const uscita = useMutation({
    mutationFn: esci,
    onSuccess: () => {
      client.clear();
      router.replace(PERCORSI.benvenuto);
    },
  });
  const nav = testi.navigazione;
  const sezione = percorso.split('/')[2] ?? '';
  const duplicati = contatori.data?.duplicati ?? 0;
  const annullamenti = contatori.data?.possibili_annullamenti ?? 0;
  const flyerDaRevisionare = contatori.data?.flyer ?? 0;
  const reclamiDaDecidere = contatori.data?.reclami ?? 0;

  return (
    <nav
      id="md-lato"
      className={aperta ? 'md-lato is-aperto' : 'md-lato'}
      aria-label={nav.etichetta}
    >
      <div className="md-marchio">
        <b>noxa</b>
        <span>{testi.marchio}</span>
      </div>
      <VoceNavigazione
        href={PERCORSI_MODERAZIONE.locali}
        icona={Store}
        etichetta={nav.locali}
        attiva={sezione === 'locali' || sezione === 'locale'}
      />
      <VoceNavigazione
        href={PERCORSI_MODERAZIONE.fonti}
        icona={Rss}
        etichetta={nav.fonti}
        attiva={sezione === 'fonti' || sezione === 'fonte'}
      />
      <VoceNavigazione
        href={PERCORSI_MODERAZIONE.duplicati}
        icona={Copy}
        etichetta={nav.duplicati}
        attiva={sezione === 'duplicati'}
        contatore={<Contatore valore={duplicati} descrizione={nav.contatoreDuplicati(duplicati)} />}
      />
      <VoceNavigazione
        href={PERCORSI_MODERAZIONE.eventi}
        icona={CalendarDays}
        etichetta={nav.eventi}
        attiva={sezione === 'eventi' || sezione === 'evento'}
        contatore={
          <Contatore valore={annullamenti} descrizione={nav.contatoreEventi(annullamenti)} />
        }
      />
      <VoceNavigazione
        href={PERCORSI_MODERAZIONE.flyer}
        icona={IconaImmagine}
        etichetta={nav.flyer}
        attiva={sezione === 'flyer'}
        contatore={
          <Contatore
            valore={flyerDaRevisionare}
            descrizione={nav.contatoreFlyer(flyerDaRevisionare)}
          />
        }
      />
      <VoceNavigazione
        href={PERCORSI_MODERAZIONE.segnalazioni}
        icona={Flag}
        etichetta={nav.segnalazioni}
        attiva={sezione === 'segnalazioni' || sezione === 'segnalazione'}
      />
      <VoceNavigazione
        href={PERCORSI_MODERAZIONE.reclami}
        icona={MessageSquare}
        etichetta={nav.reclami}
        attiva={sezione === 'reclami'}
        contatore={
          <Contatore
            valore={reclamiDaDecidere}
            descrizione={nav.contatoreReclami(reclamiDaDecidere)}
          />
        }
      />
      <div className="md-piede">
        <div className="md-utente">
          <Avatar nome={nome.data ?? ''} foto={mioAvatar.data} dimensione="s" decorativo />
          <span>
            {nome.data}
            <small>{nav.dueFattori}</small>
          </span>
        </div>
        <Link className="md-voce" href={PERCORSI.home}>
          <Icona icona={ArrowLeft} dimensione="s" />
          {nav.tornaApp}
        </Link>
        <button
          type="button"
          className="md-voce"
          onClick={() => uscita.mutate()}
          aria-busy={uscita.isPending || undefined}
        >
          <Icona icona={LogOut} dimensione="s" />
          {nav.esci}
        </button>
      </div>
    </nav>
  );
}
