'use client';

import { Navigation, WifiOff } from 'lucide-react';
import { useState } from 'react';
import { Avviso } from '@/components/ui/Avviso';
import { Icona } from '@/components/ui/Icona';
import { Pulsante } from '@/components/ui/Pulsante';
import { Caricamento } from '@/components/ui/Stati';
import { messaggi } from '@/lib/messaggi/it';
import { AvvisiSessione, BigliettoRitorno, RigaRitornoAmico } from './Componenti';
import { useRitorni } from './dati';
import { FoglioAvvia } from './FoglioAvvia';

const testi = messaggi.ritorno;

/**
 * Spazio del ritorno sicuro nell'area Vivi (design/F-21-ritorno-sicuro §1): l'invito ad
 * avviarlo o il proprio ritorno attivo, poi i ritorni ricevuti dagli amici. Nessun avvio
 * automatico e nessun richiamo (R-31, R-43).
 */
export function SezioneRitorno({ online }: { online: boolean }) {
  const ritorni = useRitorni();
  const [foglio, setFoglio] = useState(false);

  return (
    <>
      <section className="ck-sezione" aria-labelledby="rt-sezione">
        <div className="ck-sezione-testa">
          <h2 className="etichetta" id="rt-sezione">
            {testi.etichetta}
          </h2>
        </div>
        {ritorni.isPending ? (
          <Caricamento descrizione={testi.amico.caricamento} righe={2} />
        ) : ritorni.isError ? (
          <Avviso
            tipo="errore"
            titolo={testi.amico.errore}
            azioni={
              <Pulsante
                variante="secondario"
                dimensione="s"
                caricamento={ritorni.isFetching}
                onClick={() => void ritorni.refetch()}
              >
                {messaggi.comune.riprova}
              </Pulsante>
            }
          >
            {messaggi.vivi.errore.testo}
          </Avviso>
        ) : ritorni.data.mio ? (
          <>
            <AvvisiSessione mio={ritorni.data.mio} online={online} />
            <BigliettoRitorno mio={ritorni.data.mio} online={online} />
          </>
        ) : (
          <div className="rt-invito">
            <h3>{testi.invito.titolo}</h3>
            <p>{testi.invito.testo}</p>
            <Pulsante
              variante="principale"
              pieno
              disabled={!online}
              aria-describedby={online ? undefined : 'rt-motivo-offline'}
              onClick={() => setFoglio(true)}
            >
              <Icona icona={Navigation} />
              {testi.invito.avvia}
            </Pulsante>
            {!online && (
              <p className="ck-motivo" id="rt-motivo-offline">
                <Icona icona={WifiOff} dimensione="s" />
                {testi.invito.offline}
              </p>
            )}
          </div>
        )}
      </section>
      {ritorni.data && ritorni.data.ricevuti.length > 0 && (
        <section className="ck-sezione" aria-labelledby="rt-amici">
          <h2 className="etichetta" id="rt-amici">
            {testi.amici.etichetta}
          </h2>
          <ul className="m-0 list-none p-0" aria-live="polite">
            {ritorni.data.ricevuti.map((ritorno) => (
              <li key={ritorno.id}>
                <RigaRitornoAmico ritorno={ritorno} />
              </li>
            ))}
          </ul>
        </section>
      )}
      <FoglioAvvia aperto={foglio} onChiudi={() => setFoglio(false)} />
    </>
  );
}
