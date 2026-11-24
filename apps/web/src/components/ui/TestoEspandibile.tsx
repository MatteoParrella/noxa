'use client';

import { useCallback, useId, useState } from 'react';
import { classi } from '@/lib/classi';

/**
 * Testo lungo che mostra le prime righe e «Leggi tutto» (D-19): le descrizioni arrivano dai
 * siti dei locali e possono essere lunghe. Il pulsante compare solo se il testo è davvero
 * tagliato; il testo completo resta nel DOM, quindi i lettori di schermo lo leggono intero.
 */
export function TestoEspandibile({
  testo,
  righe = 3,
  etichettaApri,
  etichettaChiudi,
  className,
}: {
  testo: string;
  righe?: number;
  etichettaApri: string;
  etichettaChiudi: string;
  className?: string;
}) {
  const id = useId();
  const [aperto, setAperto] = useState(false);
  const [tagliato, setTagliato] = useState(false);
  const misura = useCallback((elemento: HTMLParagraphElement | null) => {
    if (elemento) setTagliato(elemento.scrollHeight > elemento.clientHeight + 1);
  }, []);
  return (
    <div className={classi('testo-espandibile', className)}>
      <p
        id={id}
        ref={misura}
        className={classi('m-0', !aperto && 'testo-tagliato')}
        style={aperto ? undefined : { WebkitLineClamp: righe }}
      >
        {testo}
      </p>
      {(tagliato || aperto) && (
        <button
          type="button"
          className="link-accesso testo-espandibile-pulsante"
          aria-expanded={aperto}
          aria-controls={id}
          onClick={() => setAperto((valore) => !valore)}
        >
          {aperto ? etichettaChiudi : etichettaApri}
        </button>
      )}
    </div>
  );
}
