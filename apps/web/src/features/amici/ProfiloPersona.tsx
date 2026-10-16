'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, UserX } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { z } from 'zod';
import { Avatar } from '@/components/ui/Avatar';
import { Avviso } from '@/components/ui/Avviso';
import { Icona } from '@/components/ui/Icona';
import { Entra } from '@/components/ui/Movimento';
import { Pulsante } from '@/components/ui/Pulsante';
import { Caricamento, ElencoVuoto, ErroreConAzione } from '@/components/ui/Stati';
import { useOnline } from '@/lib/connessione';
import { messaggi } from '@/lib/messaggi/it';
import {
  accettaRichiesta,
  avvisoRichiesta,
  eliminaAmicizia,
  type ProfiloPersona as Dati,
} from './api';
import { AzioniPersona } from './AzioniPersona';
import { CHIAVI, useIo, usePersona } from './dati';

const testi = messaggi.amici;

/**
 * Profilo di un'altra persona: avatar, nome, @username e le azioni del rapporto. Nessun
 * numero di amici, nessuna data, nessuna età (R-05). "Non disponibile" è uguale per tutti i
 * casi in cui il profilo non si vede (R-13, R-17).
 */
export function ProfiloPersona() {
  const io = useIo();
  const router = useRouter();
  const grezzo = useSearchParams().get('id');
  const id = z.uuid().safeParse(grezzo).success ? grezzo : null;
  const profilo = usePersona(id);

  const nonDisponibile = (
    <ElencoVuoto
      icona={UserX}
      titolo={messaggi.persona.nonDisponibile}
      azione={
        <Pulsante variante="secondario" dimensione="s" onClick={() => router.back()}>
          {messaggi.persona.torna}
        </Pulsante>
      }
    />
  );

  if (!id) return nonDisponibile;
  if (!io || profilo.isPending)
    return <Caricamento descrizione={messaggi.persona.caricamento} righe={2} />;
  if (profilo.isError) {
    return (
      <ErroreConAzione
        titolo={messaggi.comune.erroreRete.titolo}
        onRiprova={() => void profilo.refetch()}
        riprovaInCorso={profilo.isFetching}
      >
        {messaggi.comune.erroreRete.testo}
      </ErroreConAzione>
    );
  }
  if (!profilo.data) return nonDisponibile;

  return <Scheda io={io} dati={profilo.data} onBloccata={() => router.replace('/amici/')} />;
}

function Scheda({ io, dati, onBloccata }: { io: string; dati: Dati; onBloccata: () => void }) {
  const online = useOnline();
  const client = useQueryClient();
  const { persona, relazione } = dati;

  const avviso = useQuery({
    queryKey: [
      ...CHIAVI.relazioni,
      'avviso',
      relazione.tipo === 'ricevuta' ? relazione.amiciziaId : '',
    ],
    queryFn: () => avvisoRichiesta(relazione.tipo === 'ricevuta' ? relazione.amiciziaId : ''),
    enabled: relazione.tipo === 'ricevuta' && relazione.canale === 'codice_invito',
  });

  const azione = useMutation({
    mutationFn: ({ accetta, amiciziaId }: { accetta: boolean; amiciziaId: string }) =>
      accetta ? accettaRichiesta(amiciziaId) : eliminaAmicizia(amiciziaId),
    onSettled: () => client.invalidateQueries({ queryKey: CHIAVI.relazioni }),
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-end">
        <AzioniPersona
          io={io}
          persona={persona}
          amiciziaId={relazione.tipo === 'amici' ? relazione.amiciziaId : undefined}
          onBloccata={onBloccata}
        />
      </div>
      <Entra className="persona-grande" indice={1}>
        <Avatar nome={persona.nome_visualizzato} dimensione="xl" decorativo />
        <h2 className="pg-nome">{persona.nome_visualizzato}</h2>
        <p className="pg-user m-0">@{persona.username}</p>
      </Entra>

      {azione.isError && <Avviso tipo="errore">{testi.erroreAzione}</Avviso>}

      {relazione.tipo === 'amici' && (
        <p className="t-corpo c-2 m-0 text-center">{testi.giaAmici}</p>
      )}

      {relazione.tipo === 'inviata' && (
        <div className="flex items-center justify-center gap-3">
          <span className="inviata">
            <Icona icona={Clock} dimensione="s" />
            {testi.richiestaInviata}
          </span>
          <Pulsante
            variante="testo"
            dimensione="s"
            disabled={!online || azione.isPending}
            onClick={() => azione.mutate({ accetta: false, amiciziaId: relazione.amiciziaId })}
          >
            {testi.annulla}
          </Pulsante>
        </div>
      )}

      {relazione.tipo === 'ricevuta' && (
        <div className="flex flex-col gap-4">
          <p className="t-corpo m-0 text-center">{testi.vuoleAggiungerti}</p>
          {avviso.data === true && (
            <Avviso tipo="avviso" titolo={messaggi.anteprima.avvisoTitolo}>
              {messaggi.anteprima.avvisoTesto}
            </Avviso>
          )}
          <div className="azioni-doppie">
            <Pulsante
              variante="secondario"
              disabled={!online || azione.isPending}
              onClick={() => azione.mutate({ accetta: false, amiciziaId: relazione.amiciziaId })}
            >
              {testi.rifiuta}
            </Pulsante>
            <Pulsante
              variante="secondario"
              disabled={
                !online ||
                azione.isPending ||
                (avviso.isPending && relazione.canale === 'codice_invito')
              }
              caricamento={azione.isPending}
              onClick={() => azione.mutate({ accetta: true, amiciziaId: relazione.amiciziaId })}
            >
              {testi.accetta}
            </Pulsante>
          </div>
        </div>
      )}
    </div>
  );
}
