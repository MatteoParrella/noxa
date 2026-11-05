'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Info, WifiOff } from 'lucide-react';
import { useState } from 'react';
import { Avviso } from '@/components/ui/Avviso';
import { Foglio } from '@/components/ui/Foglio';
import { Icona } from '@/components/ui/Icona';
import { Interruttore } from '@/components/ui/Interruttore';
import { Pulsante } from '@/components/ui/Pulsante';
import { Caricamento } from '@/components/ui/Stati';
import { useToast } from '@/components/ui/Toast';
import { elencoNomi } from '@/lib/messaggi/vivi';
import { messaggi } from '@/lib/messaggi/it';
import { salvaCheckinAbilitato } from './api';
import { CHIAVI, useCheckinAbilitato, useMioCheckin } from './dati';

const testi = messaggi.vivi.impostazione;

/**
 * Riga "Check-in «sono qui»" di Privacy e dati (design/F-20-checkin §4, R-30): spenta di
 * default; spegnerla con un check-in attivo lo termina, e un foglio lo dice prima.
 */
export function ImpostazioneCheckin({ io, online }: { io: string; online: boolean }) {
  const client = useQueryClient();
  const mostraToast = useToast();
  const abilitato = useCheckinAbilitato();
  const mio = useMioCheckin();
  const [conferma, setConferma] = useState(false);
  const [fallito, setFallito] = useState<boolean | null>(null);
  const chiave = CHIAVI.abilitato(io);

  const salva = useMutation({
    mutationFn: (nuovo: boolean) => salvaCheckinAbilitato(io, nuovo),
    onMutate: async (nuovo) => {
      setFallito(null);
      await client.cancelQueries({ queryKey: chiave });
      client.setQueryData(chiave, nuovo);
      return { prima: !nuovo };
    },
    onError: (_errore, _nuovo, contesto) => {
      if (contesto) {
        client.setQueryData(chiave, contesto.prima);
        setFallito(contesto.prima);
      }
    },
    onSuccess: () => mostraToast({ testo: messaggi.privacy.pagina.salvato }),
    onSettled: () => void client.invalidateQueries({ queryKey: CHIAVI.vivi }),
  });

  if (abilitato.isPending) return <Caricamento descrizione={testi.titolo} righe={1} />;
  const attivo = abilitato.data ?? false;

  const cambia = (nuovo: boolean) => {
    if (!nuovo && mio.data) setConferma(true);
    else salva.mutate(nuovo);
  };

  return (
    <div className="pv-impostazione">
      {fallito !== null && (
        <Avviso
          tipo="errore"
          titolo={messaggi.privacy.pagina.salvataggio.titolo}
          portaInVista
          azioni={
            <Pulsante variante="secondario" dimensione="s" onClick={() => salva.mutate(!fallito)}>
              {messaggi.comune.riprova}
            </Pulsante>
          }
        >
          {messaggi.privacy.pagina.salvataggio.testo(fallito)}
        </Avviso>
      )}
      <Interruttore
        etichetta={testi.titolo}
        descrizione={testi.testo}
        attivo={attivo}
        disabled={!online || salva.isPending || abilitato.isError}
        onCambia={cambia}
      />
      <p className="pv-nota">
        <Icona icona={online ? Info : WifiOff} />
        {!online ? testi.offline : attivo ? testi.acceso : testi.spento}
      </p>
      <Foglio aperto={conferma} onChiudi={() => setConferma(false)} titolo={testi.spegni.titolo}>
        {mio.data && (
          <div className="flex flex-col gap-4">
            <Avviso tipo="info">
              {testi.spegni.testo(
                mio.data.locale.nome,
                elencoNomi(mio.data.destinatari.map((persona) => persona.nome_visualizzato)),
              )}
            </Avviso>
            <div className="nf-azioni">
              <Pulsante variante="secondario" pieno onClick={() => setConferma(false)}>
                {testi.spegni.annulla}
              </Pulsante>
              <Pulsante
                variante="principale"
                pieno
                onClick={() => {
                  setConferma(false);
                  salva.mutate(false);
                }}
              >
                {testi.spegni.conferma}
              </Pulsante>
            </div>
          </div>
        )}
      </Foglio>
    </div>
  );
}
