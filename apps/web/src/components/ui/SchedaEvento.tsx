import { X } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { messaggi } from '@/lib/messaggi/it';
import { Badge, Genere } from './Badge';
import { Copertina, type DatiCopertina } from './Copertina';
import { Icona } from './Icona';

export type DatiSchedaEvento = {
  href: string;
  /** Nome accessibile del link: titolo, locale, comune, quando, età. */
  nome: string;
  titolo: string;
  locale: string;
  comune: string;
  /** "gio 15.10 · 23:00 → 05:00" (evidenza) */
  quando: string;
  /** "23:00" */
  ora: string;
  /** "23:00 → 05:00" */
  orario: string;
  /** Età minima già calcolata nel database: "18+" o "18+ · non dichiarata". */
  eta: string;
  /** Al massimo due generi nelle schede (design/F-01-scopri). */
  generi: string[];
  /** Distanza e prezzo minimo, solo se noti. */
  meta: string[];
  annullato?: boolean;
  copertina: DatiCopertina;
  /** Riga "amici che partecipano" (AmiciPartecipano). */
  amici?: ReactNode;
};

function Etichette({ dati, conEta }: { dati: DatiSchedaEvento; conEta: boolean }) {
  return (
    <div className="rc-tag">
      {dati.annullato && (
        <Badge variante="annullato">
          <Icona icona={X} dimensione="s" />
          {messaggi.scopri.annullato}
        </Badge>
      )}
      {conEta && <Badge variante="eta">{dati.eta}</Badge>}
      {dati.generi.slice(0, 2).map((genere) => (
        <Genere key={genere}>{genere}</Genere>
      ))}
    </div>
  );
}

function Meta({ meta }: { meta: string[] }) {
  if (meta.length === 0) return null;
  return (
    <div className="rc-meta">
      {meta.map((voce) => (
        <span key={voce}>{voce}</span>
      ))}
    </div>
  );
}

/** Prima scheda della serata: copertina grande con orario, titolo e locale (design/F-01-scopri). */
export function SchedaEvidenza({ dati }: { dati: DatiSchedaEvento }) {
  return (
    <Link className="evidenza" href={dati.href} aria-label={dati.nome}>
      <Copertina copertina={dati.copertina} forma="evidenza" ora={dati.ora} titolo={dati.titolo}>
        <span className="badge-sopra">
          <Badge variante="eta">{dati.eta}</Badge>
        </span>
        <span className="t-mono-dato">{dati.quando}</span>
        <h3 className="evidenza-titolo">{dati.titolo}</h3>
        <span className="t-corpo-s">
          {dati.locale} · {dati.comune}
        </span>
      </Copertina>
      <span className="evidenza-corpo">
        <Etichette dati={dati} conEta={false} />
        <Meta meta={dati.meta} />
        {dati.amici}
      </span>
    </Link>
  );
}

/** Riga compatta dell'elenco con miniatura, orario, badge d'età e generi. */
export function RigaEvento({ dati }: { dati: DatiSchedaEvento }) {
  return (
    <Link className="riga-compatta" href={dati.href} aria-label={dati.nome}>
      <Copertina
        copertina={dati.copertina}
        forma="miniatura"
        ora={dati.ora}
        titolo={dati.titolo}
        className="miniatura"
      />
      <span className="min-w-0">
        <h3 className="rc-titolo">{dati.titolo}</h3>
        <span className="rc-luogo">
          {dati.locale} · {dati.comune}
        </span>
        <span className="rc-ora">{dati.orario}</span>
        <Etichette dati={dati} conEta />
        <Meta meta={dati.meta} />
        {dati.amici}
      </span>
    </Link>
  );
}
