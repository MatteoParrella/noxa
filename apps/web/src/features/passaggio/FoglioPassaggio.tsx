'use client';

import Link from 'next/link';
import { Foglio } from '@/components/ui/Foglio';
import { messaggi } from '@/lib/messaggi/it';
import { ElencoPassaggio } from './ElencoPassaggio';

const testi = messaggi.passaggio;

type Props = { aperto: boolean; onChiudi: () => void };

/**
 * Lo stesso elenco fuori da Vivi (serata di gruppo, F-16). In fondo ricorda il ritorno
 * sicuro, senza insistere (R-43): un solo link, mai un avviso.
 */
export function FoglioPassaggio({ aperto, onChiudi }: Props) {
  return (
    <Foglio aperto={aperto} onChiudi={onChiudi} titolo={testi.titolo}>
      <div className="ps-foglio">
        <p className="t-corpo-s c-2 m-0">{testi.testo}</p>
        <ElencoPassaggio />
        <p className="ps-ritorno">
          {testi.ritorno}{' '}
          <Link className="link-in-testo" href="/vivi/">
            {testi.vaiAVivi}
          </Link>
        </p>
      </div>
    </Foglio>
  );
}
