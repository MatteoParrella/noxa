import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Icona } from '@/components/ui/Icona';
import { messaggi } from '@/lib/messaggi/it';
import type { RispostaSerata, StatoSerata } from './api';
import { oraRitrovo, partiData } from './formato';

const testi = messaggi.gruppi;

type Props = {
  id: string;
  titolo: string | null;
  dataSerata: string;
  ora: string | null;
  stato: StatoSerata;
  /** Riga sotto il titolo: nome del gruppo o locale. */
  sotto: string | null;
  /** Conteggi delle risposte (dettaglio del gruppo). */
  risposte?: { si: number; forse: number };
  /** La propria risposta come badge (area Organizza). */
  miaRisposta?: RispostaSerata | null;
};

/** Riga della serata (design/F-14-serata §4): data in monospaziato, titolo, sotto e risposta. */
export function RigaSerata({
  id,
  titolo,
  dataSerata,
  ora,
  stato,
  sotto,
  risposte,
  miaRisposta,
}: Props) {
  const { giorno, data } = partiData(dataSerata);
  const nome = titolo ?? testi.serata.libera;
  const oraTesto = oraRitrovo(ora);
  return (
    <li>
      <Link className="sr-riga" href={`/serata/?id=${id}`}>
        <span className="sr-data">
          {giorno}
          <b>{data}</b>
        </span>
        <span className="sr-corpo">
          <b>{nome}</b>
          {(sotto || oraTesto) && <small>{[oraTesto, sotto].filter(Boolean).join(' · ')}</small>}
          {risposte && (
            <span className="sr-risposte">
              {testi.dettaglio.risposte(risposte.si, risposte.forse)}
            </span>
          )}
        </span>
        <span className="flex items-center gap-2">
          {stato === 'annullata' ? (
            <Badge className="badge-se-annullata">{testi.serata.annullata}</Badge>
          ) : miaRisposta !== undefined ? (
            <Badge className={miaRisposta ? `badge-risp-${miaRisposta}` : 'badge-risp-da'}>
              {miaRisposta ? testi.serata.risposte[miaRisposta] : testi.serata.nonRispostoBreve}
            </Badge>
          ) : null}
          <Icona icona={ChevronRight} dimensione="s" className="c-2" />
        </span>
      </Link>
    </li>
  );
}
