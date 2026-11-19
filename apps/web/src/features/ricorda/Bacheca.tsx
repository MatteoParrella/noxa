'use client';

import {
  Award,
  CircleDashed,
  Disc3,
  Ear,
  House,
  Leaf,
  MapPin,
  NotebookPen,
  PenLine,
  Plus,
  Users,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Foglio } from '@/components/ui/Foglio';
import { Icona } from '@/components/ui/Icona';
import { Caricamento, ElencoVuoto, ErroreConAzione, StrisciaOffline } from '@/components/ui/Stati';
import { classi } from '@/lib/classi';
import { useOnline } from '@/lib/connessione';
import { messaggi } from '@/lib/messaggi/it';
import type { BadgeBacheca, TipoCriterio } from './api-anno';
import { useBadge } from './dati-anno';
import { EtichettaPrivato } from './Diario';

const testi = messaggi.ricorda.badge;

/** Icona di ogni tipo di criterio: segnaletica a linea, mai bicchieri, soldi o orari (R-41). */
export const ICONE: Record<TipoCriterio, LucideIcon> = {
  serate: NotebookPen,
  locali_diversi: MapPin,
  generi_diversi: Ear,
  dj_diversi: Disc3,
  serate_con_note: PenLine,
  quattro_stagioni: Leaf,
  stesso_locale: House,
  serate_con_amici: Users,
};

/** Numerale romano finale del nome («Esploratore II»), mostrato sull'illustrazione. */
function numerale(nome: string): string | null {
  return /\s(I{1,3}|IV|V)$/.exec(nome)?.[1] ?? null;
}

const data = (iso: string) =>
  new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
    .format(new Date(iso))
    .replaceAll('/', '.');

const dataLetta = (iso: string) =>
  new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso));

export function criterio(badge: Pick<BadgeBacheca, 'criterio'>): string {
  return testi.criteri[badge.criterio.tipo](badge.criterio.soglia);
}

/** Illustrazione del badge: cartello tondo, pieno se ottenuto, tratteggiato se no. */
export function IllustrazioneBadge({
  badge,
  grande = false,
}: {
  badge: Pick<BadgeBacheca, 'criterio' | 'nome' | 'ottenutoIl'>;
  grande?: boolean;
}) {
  const numero = numerale(badge.nome);
  return (
    <span
      className={classi('ri-illu', badge.ottenutoIl ? 'is-ok' : 'is-no', grande && 'is-grande')}
      aria-hidden="true"
    >
      <Icona icona={ICONE[badge.criterio.tipo]} />
      {numero && <em>{numero}</em>}
    </span>
  );
}

/** Ricorda › Badge (design/F-32-badge §1): ottenuti con la data, gli altri con il criterio. */
export function Bacheca() {
  const query = useBadge();
  const online = useOnline();
  const parametri = useSearchParams();
  const router = useRouter();
  const percorso = usePathname();
  const aperto = query.data?.find((b) => b.codice === parametri.get('badge')) ?? null;

  const apri = (codice: string | null) =>
    router.replace(codice ? `${percorso}?badge=${codice}` : percorso, { scroll: false });

  if (!query.data) {
    if (query.isError) {
      return (
        <ErroreConAzione
          titolo={testi.errore.titolo}
          onRiprova={() => void query.refetch()}
          riprovaInCorso={query.isFetching}
        >
          {testi.errore.testo}
        </ErroreConAzione>
      );
    }
    return <Caricamento descrizione={testi.caricamento} righe={3} />;
  }

  const ottenuti = query.data
    .filter((b) => b.ottenutoIl !== null)
    .sort((a, b) => (b.ottenutoIl ?? '').localeCompare(a.ottenutoIl ?? '') || b.ordine - a.ordine);
  const daOttenere = query.data.filter((b) => b.ottenutoIl === null);

  return (
    <div className="flex flex-col">
      {!online && <StrisciaOffline testo={testi.offline} />}
      {ottenuti.length === 0 ? (
        <div className="pt-2 pb-4">
          <ElencoVuoto
            icona={Award}
            titolo={testi.vuoto.titolo}
            azione={
              <Link className="btn btn-principale" href="/ricorda/modifica/">
                <Icona icona={Plus} dimensione="s" />
                {messaggi.ricorda.area.aggiungi}
              </Link>
            }
          >
            {testi.vuoto.testo}
          </ElencoVuoto>
        </div>
      ) : (
        <Gruppo
          titolo={testi.ottenuti}
          nota={testi.contatore(ottenuti.length, query.data.length)}
          badge={ottenuti}
          onApri={apri}
        />
      )}
      {daOttenere.length > 0 && (
        <Gruppo
          titolo={testi.daOttenere}
          {...(ottenuti.length === 0 ? { nota: testi.contatore(0, query.data.length) } : {})}
          badge={daOttenere}
          onApri={apri}
        />
      )}
      <Foglio aperto={aperto !== null} onChiudi={() => apri(null)} titolo={aperto?.nome ?? ''}>
        {aperto && <Dettaglio badge={aperto} />}
      </Foglio>
    </div>
  );
}

function Gruppo({
  titolo,
  nota,
  badge,
  onApri,
}: {
  titolo: string;
  nota?: string;
  badge: readonly BadgeBacheca[];
  onApri: (codice: string) => void;
}) {
  return (
    <section className="ri-badge-gruppo" aria-label={titolo}>
      <h2 className="ri-badge-testa">
        {titolo}
        {nota && <span>{nota}</span>}
      </h2>
      <ul className="ri-badge-griglia">
        {badge.map((b) => (
          <li key={b.codice}>
            <button
              type="button"
              className="ri-tessera"
              onClick={() => onApri(b.codice)}
              aria-label={
                b.ottenutoIl
                  ? testi.nomeOttenuto(b.nome, dataLetta(b.ottenutoIl))
                  : testi.nomeDaOttenere(b.nome)
              }
            >
              <IllustrazioneBadge badge={b} />
              <b>{b.nome}</b>
              {b.ottenutoIl ? (
                <small>{data(b.ottenutoIl)}</small>
              ) : (
                <>
                  <span className="ri-da">
                    <Icona icona={CircleDashed} dimensione="s" />
                    {testi.daOttenere}
                  </span>
                  <span className="ri-crit">{criterio(b)}</span>
                </>
              )}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Foglio di dettaglio (design/F-32-badge §2): nessun pulsante per condividere. */
function Dettaglio({ badge }: { badge: BadgeBacheca }) {
  return (
    <div className="ri-badge-dettaglio">
      <IllustrazioneBadge badge={badge} grande />
      {badge.ottenutoIl ? (
        <p>{badge.descrizione}</p>
      ) : (
        <p>
          <b>{testi.comeSiOttiene}</b>
          <br />
          {criterio(badge)}.
        </p>
      )}
      <dl className="ri-badge-info">
        <div>
          <dt>{badge.ottenutoIl ? testi.ottenutoIl : testi.stato}</dt>
          <dd>
            {badge.ottenutoIl ? (
              <span className="mono">{data(badge.ottenutoIl)}</span>
            ) : (
              <span className="ri-da">
                <Icona icona={CircleDashed} dimensione="s" />
                {testi.daOttenere}
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt>{testi.visibilita}</dt>
          <dd>
            <EtichettaPrivato />
          </dd>
        </div>
      </dl>
    </div>
  );
}
