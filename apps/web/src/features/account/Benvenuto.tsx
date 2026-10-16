'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, type CSSProperties } from 'react';
import { Entra } from '@/components/ui/Movimento';
import { messaggi } from '@/lib/messaggi/it';
import { PERCORSI } from './documenti';
import { Schermata } from './Schermata';
import { useSessione } from './sessione';

/** Prima schermata senza account: l'unica con il bagliore arancio (design/F-10-accesso). */
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
      <Entra className="mt-5 flex flex-col gap-5" indice={2}>
        <p className="frase-benvenuto">{testi.frase}</p>
        <p className="t-mono-dato c-2 m-0 flex flex-wrap gap-x-3.5 gap-y-1">
          {testi.aree.map((area) => (
            <span key={area}>{area}</span>
          ))}
        </p>
      </Entra>
    </Schermata>
  );
}
