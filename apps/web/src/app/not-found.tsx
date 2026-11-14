import type { Metadata } from 'next';
import Link from 'next/link';
import { Schermata } from '@/features/account/Schermata';
import { messaggi } from '@/lib/messaggi/it';

export const metadata: Metadata = { title: 'Pagina non trovata · Noxa' };

/** Pagina 404 dell'export statico (Cloudflare Pages serve `404.html` per gli indirizzi ignoti). */
export default function NonTrovata() {
  const testi = messaggi.nonTrovata;
  return (
    <Schermata
      etichetta={testi.etichetta}
      titolo={testi.titolo}
      piede={
        <Link className="btn btn-l btn-principale btn-pieno" href="/scopri/">
          {testi.azione}
        </Link>
      }
    >
      <p className="t-corpo c-2 mt-4 mb-0">{testi.testo}</p>
    </Schermata>
  );
}
