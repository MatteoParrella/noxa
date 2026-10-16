'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Ban } from 'lucide-react';
import { useState } from 'react';
import { Pulsante } from '@/components/ui/Pulsante';
import { RigaPersona } from '@/components/ui/RigaPersona';
import { Caricamento, ElencoVuoto, ErroreConAzione } from '@/components/ui/Stati';
import { useOnline } from '@/lib/connessione';
import { messaggi } from '@/lib/messaggi/it';
import { sblocca, type Bloccato } from './api';
import { CHIAVI, useBloccati, useIo } from './dati';
import { FoglioConferma } from './FoglioConferma';

const testi = messaggi.bloccati;

/** Persone bloccate (F-42): sbloccare chiede conferma e non ripristina l'amicizia (R-17). */
export function PersoneBloccate() {
  const io = useIo();
  const online = useOnline();
  const client = useQueryClient();
  const bloccati = useBloccati();
  const [daSbloccare, setDaSbloccare] = useState<Bloccato | null>(null);

  if (!io || bloccati.isPending) return <Caricamento descrizione={testi.caricamento} />;
  if (bloccati.isError) {
    return (
      <ErroreConAzione
        titolo={messaggi.comune.erroreRete.titolo}
        onRiprova={() => void bloccati.refetch()}
        riprovaInCorso={bloccati.isFetching}
      >
        {messaggi.comune.erroreRete.testo}
      </ErroreConAzione>
    );
  }
  if (bloccati.data.length === 0) {
    return (
      <ElencoVuoto icona={Ban} titolo={testi.vuoto.titolo}>
        {testi.vuoto.testo}
      </ElencoVuoto>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="t-corpo-s c-2 m-0">{testi.spiegazione}</p>
      <ul className="m-0 list-none p-0">
        {bloccati.data.map((persona) => (
          <RigaPersona
            key={persona.id}
            nome={persona.nome_visualizzato}
            username={persona.username}
            azioni={
              <Pulsante
                variante="secondario"
                dimensione="s"
                disabled={!online}
                onClick={() => setDaSbloccare(persona)}
              >
                {testi.sblocca}
              </Pulsante>
            }
          />
        ))}
      </ul>
      {daSbloccare && (
        <FoglioConferma
          titolo={testi.sbloccaTitolo(daSbloccare.username)}
          testo={testi.sbloccaTesto}
          conferma={testi.sblocca}
          onConferma={() => sblocca(io, daSbloccare.id)}
          onFatto={() => {
            setDaSbloccare(null);
            void client.invalidateQueries({ queryKey: CHIAVI.relazioni });
          }}
          onChiudi={() => setDaSbloccare(null)}
        />
      )}
    </div>
  );
}
