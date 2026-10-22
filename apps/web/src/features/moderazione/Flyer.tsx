'use client';

import { AlertTriangle, Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Icona } from '@/components/ui/Icona';
import { Caricamento, ElencoVuoto, ErroreConAzione } from '@/components/ui/Stati';
import { messaggi } from '@/lib/messaggi/it';
import { useCodaFlyer } from './dati';
import { dataOra } from './formato';

const testi = messaggi.moderazione.codaFlyer;

function statoVariante(stato: 'in_revisione' | 'errore'): 'accento' | 'avviso' {
  return stato === 'errore' ? 'avviso' : 'accento';
}

/** Coda dei flyer in attesa di revisione o con errore di estrazione (R-51). */
export function Flyer() {
  const coda = useCodaFlyer();

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
      <ElencoVuoto icona={ImageIcon} titolo={testi.vuoto.titolo}>
        {testi.vuoto.testo}
      </ElencoVuoto>
    );
  }

  return (
    <div className="md-tabella-contenitore" role="region" aria-label={testi.titolo}>
      <table className="md-tabella">
        <thead>
          <tr>
            <th scope="col">{testi.colonne.data}</th>
            <th scope="col">{testi.colonne.stato}</th>
            <th scope="col" aria-label={testi.sospetto}>
              <AlertTriangle aria-hidden="true" className="ico ico-s" strokeWidth={1.75} />
            </th>
            <th scope="col">
              <span className="sr-only">{testi.colonne.azioni}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {coda.data.map((flyer) => (
            <tr key={flyer.id}>
              <td>
                <time dateTime={flyer.creato_il}>{dataOra(flyer.creato_il)}</time>
              </td>
              <td>
                <Badge variante={statoVariante(flyer.stato)}>{testi.stati[flyer.stato]}</Badge>
              </td>
              <td>{flyer.contenuto_sospetto && <Icona icona={AlertTriangle} dimensione="s" />}</td>
              <td>
                <Link href={`/moderazione/flyer/?id=${flyer.id}`} className="btn btn-testo btn-s">
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
