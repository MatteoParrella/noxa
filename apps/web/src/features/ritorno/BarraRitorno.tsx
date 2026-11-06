'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Pulsante } from '@/components/ui/Pulsante';
import { useOnline } from '@/lib/connessione';
import { messaggi } from '@/lib/messaggi/it';
import { useConcludi } from './Componenti';
import { avviatoQui, useRitorni } from './dati';
import { oraDi } from './formato';
import { serveNotaSchermo } from './posizione';

const testi = messaggi.ritorno;

/**
 * Indicatore permanente del ritorno attivo (R-31, design §4): una barra in cima a tutte le aree
 * con "Sono arrivato"; da desktop sta nella barra laterale (`variante="laterale"`). Nel browser
 * del telefono ricorda che a schermo bloccato gli amici vedono dove eri; nell'app Android c'è
 * la notifica fissa e la nota non compare.
 */
export function BarraRitorno({ variante = 'cima' }: { variante?: 'cima' | 'laterale' }) {
  const ritorni = useRitorni();
  const online = useOnline();
  const mio = ritorni.data?.mio ?? null;
  const concludi = useConcludi(mio);
  const percorso = usePathname();
  if (!mio) return null;
  const dettaglio = testi.barra.dettaglio(oraDi(mio.arrivoPrevisto), mio.destinatari.length);
  const pwa = serveNotaSchermo() && avviatoQui(mio);
  const sonoArrivato = (
    <Pulsante
      variante="secondario"
      dimensione="s"
      disabled={!online}
      caricamento={concludi.isPending}
      onClick={() => concludi.mutate('arrivato')}
    >
      {testi.mio.arrivato}
    </Pulsante>
  );

  if (variante === 'laterale') {
    return (
      <div className="rt-rail" role="status">
        <Link href="/vivi/ritorno/" className="min-w-0">
          <b>{testi.barra.titolo}</b>
          <span>{dettaglio}</span>
        </Link>
        {sonoArrivato}
        {pwa && <p className="rt-rail-pwa">{testi.barra.pwa}</p>}
      </div>
    );
  }
  // Nel dettaglio del ritorno le stesse azioni sono già in pagina.
  const nelDettaglio = percorso.startsWith('/vivi/ritorno');
  return (
    <div className="rt-barra-guscio">
      <div className="rt-barra" role="status">
        <Link href="/vivi/ritorno/" className="testo">
          <b>{testi.barra.titolo}</b>
          <span>{dettaglio}</span>
        </Link>
        {!nelDettaglio && sonoArrivato}
      </div>
      {pwa && <p className="rt-barra-pwa">{testi.barra.pwa}</p>}
    </div>
  );
}
