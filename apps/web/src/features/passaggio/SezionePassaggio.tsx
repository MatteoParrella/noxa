'use client';

import { messaggi } from '@/lib/messaggi/it';
import { ElencoPassaggio } from './ElencoPassaggio';

const testi = messaggi.passaggio;

/**
 * «Non hai un passaggio?» nell'area Vivi (F-23, ADR-0034): sempre lì, anche senza un ritorno
 * sicuro attivo e senza doverlo avviare. Nessun richiamo e nessuna urgenza (R-43).
 */
export function SezionePassaggio() {
  return (
    <section className="ck-sezione" aria-labelledby="ps-sezione">
      <div className="ck-sezione-testa">
        <h2 className="etichetta" id="ps-sezione">
          {testi.etichetta}
        </h2>
      </div>
      <div className="ps-scheda">
        <h3>{testi.titolo}</h3>
        <p>{testi.testo}</p>
        <ElencoPassaggio />
      </div>
    </section>
  );
}
