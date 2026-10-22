'use client';

import { Flag } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Caricamento, ElencoVuoto, ErroreConAzione } from '@/components/ui/Stati';
import { messaggi } from '@/lib/messaggi/it';
import { useCodaSegnalazioni } from './dati';
import { dataOra } from './formato';

const testi = messaggi.moderazione.codaSegnalazioni;

type VariantePriorita = 'errore' | 'avviso' | 'tenue';
function prioritaVariante(p: number): VariantePriorita {
  if (p === 1) return 'errore';
  if (p === 2) return 'avviso';
  return 'tenue';
}

/** Coda delle segnalazioni per priorità e scadenza (R-53, R-69). */
export function Segnalazioni() {
  const coda = useCodaSegnalazioni();

  if (coda.isPending) return <Caricamento descrizione={testi.caricamento} />;
  if (coda.isError) {
    return (
      <ErroreConAzione
        titolo={messaggi.comune.erroreRete.titolo}
        onRiprova={() => void coda.refetch()}
        riprovaInCorso={coda.isFetching}
      >
        {messaggi.comune.erroreRete.testo}
      </ErroreConAzione>
    );
  }
  if (coda.data.length === 0) {
    return (
      <ElencoVuoto icona={Flag} titolo={testi.vuoto.titolo}>
        {testi.vuoto.testo}
      </ElencoVuoto>
    );
  }

  return (
    <div className="md-tabella-contenitore" role="region" aria-label={testi.titolo}>
      <table className="md-tabella">
        <thead>
          <tr>
            <th scope="col">{testi.colonne.priorita}</th>
            <th scope="col">{testi.colonne.tipo}</th>
            <th scope="col">{testi.colonne.motivo}</th>
            <th scope="col">{testi.colonne.scadenza}</th>
            <th scope="col">{testi.colonne.stato}</th>
            <th scope="col">
              <span className="sr-only">{testi.colonne.azioni}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {coda.data.map((s) => (
            <tr key={s.id}>
              <td>
                <Badge variante={prioritaVariante(s.priorita)}>
                  {testi.priorita[s.priorita] ?? String(s.priorita)}
                </Badge>
              </td>
              <td className="mono t-corpo-piccolo">{s.tipo_oggetto}</td>
              <td className="t-corpo-piccolo">{s.motivo.replace(/_/g, ' ')}</td>
              <td>
                <time
                  dateTime={s.scadenza}
                  className={isScaduta(s.scadenza) ? 'c-errore font-medium' : ''}
                >
                  {dataOra(s.scadenza)}
                </time>
              </td>
              <td>
                <Badge
                  variante={s.stato === 'chiusa' ? 'successo' : s.presa_da_me ? 'accento' : 'tenue'}
                >
                  {testi.stati[s.stato]}
                  {s.presa_da && ` · ${s.presa_da}`}
                </Badge>
              </td>
              <td>
                <Link
                  href={`/moderazione/segnalazione/?id=${s.id}`}
                  className="btn btn-testo btn-s"
                >
                  {testi.apri}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function isScaduta(scadenza: string): boolean {
  return new Date(scadenza) < new Date();
}
