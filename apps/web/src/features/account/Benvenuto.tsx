'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, type CSSProperties } from 'react';
import { Copertina } from '@/components/ui/Copertina';
import { Entra } from '@/components/ui/Movimento';
import type { Famiglia } from '@/lib/copertinaGenerata';
import { messaggi } from '@/lib/messaggi/it';
import { PERCORSI } from './documenti';
import { Schermata } from './Schermata';
import { useSessione } from './sessione';

/** Una copertina generata per promessa: motivi di esempio, nessun evento reale (R-07). */
const FAMIGLIE_PROMESSE: readonly Famiglia[] = ['house', 'techno', 'accento', 'dnb'];

/** Prima schermata senza account: l'unica con il bagliore della tinta (design/F-10-accesso). */
export function Benvenuto() {
  const testi = messaggi.benvenuto;
  const router = useRouter();
  const sessione = useSessione();

  useEffect(() => {
    if (sessione.stato === 'presente') router.replace(PERCORSI.home);
  }, [sessione, router]);

  return (
    <Schermata
      bagliore
      inFondo
      largo
      piedeSenzaFilo
      piede={
        <>
          <Link className="btn btn-l btn-principale btn-pieno" href={PERCORSI.registrazione}>
            {testi.creaAccount}
          </Link>
          <Link className="btn btn-l btn-secondario btn-pieno" href={PERCORSI.accesso}>
            {testi.hoGiaUnAccount}
          </Link>
          <p className="testo-piccolo flex justify-center gap-1">
            <Link className="link-accesso px-2" href={PERCORSI.termini}>
              {testi.termini}
            </Link>
            <span className="flex items-center" aria-hidden="true">
              ·
            </span>
            <Link className="link-accesso px-2" href={PERCORSI.privacy}>
              {testi.privacy}
            </Link>
          </p>
        </>
      }
    >
      <div className="etichetta-riga mb-3">
        <span className="etichetta">{testi.luogo}</span>
      </div>
      <h1 className="marchio-benvenuto titolo-rivelato" aria-label={testi.marchio}>
        <span className="parola" aria-hidden="true">
          <span style={{ '--indice': 0 } as CSSProperties}>{testi.marchio}</span>
        </span>
        <span className="marchio-punto" aria-hidden="true" />
      </h1>
      <Entra className="mt-5" indice={2}>
        <p className="frase-benvenuto">{testi.frase}</p>
      </Entra>
      <Entra className="mt-6" indice={3}>
        <h2 className="sr-only">{testi.promesseTitolo}</h2>
        {/* Fila che scorre: raggiungibile da tastiera, come chiede WCAG per le aree scorrevoli. */}
        <ul className="promesse" tabIndex={0} aria-label={testi.promesseTitolo}>
          {testi.promesse.map((promessa, indice) => (
            <li key={promessa.area} className="promessa">
              <Copertina
                copertina={{
                  tipo: 'tipografica',
                  alt: '',
                  generata: {
                    seme: `benvenuto-${promessa.area}`,
                    famiglia: FAMIGLIE_PROMESSE[indice] ?? 'accento',
                  },
                }}
                forma="miniatura"
                ora={`0${indice + 1}`}
                titolo={promessa.area}
                className="promessa-copertina"
              />
              <div className="promessa-corpo">
                <h3 className="rc-titolo">{promessa.titolo}</h3>
                <p className="t-corpo-s c-2 m-0">{promessa.testo}</p>
              </div>
            </li>
          ))}
        </ul>
      </Entra>
    </Schermata>
  );
}
