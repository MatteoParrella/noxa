'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Avviso } from '@/components/ui/Avviso';
import { Icona } from '@/components/ui/Icona';
import { Pulsante } from '@/components/ui/Pulsante';
import { messaggi } from '@/lib/messaggi/it';
import { esci } from './api';
import { PERCORSI } from './documenti';

/** Uscita dall'account su questo dispositivo: cancella la sessione e i dati in memoria. */
export function PulsanteEsci() {
  const router = useRouter();
  const client = useQueryClient();
  const uscita = useMutation({
    mutationFn: esci,
    onSuccess: () => {
      client.clear();
      router.replace(PERCORSI.benvenuto);
    },
  });
  return (
    <div className="flex flex-col gap-3">
      <Pulsante
        variante="secondario"
        caricamento={uscita.isPending}
        className="self-start"
        onClick={() => uscita.mutate()}
      >
        <Icona icona={LogOut} />
        {messaggi.profilo.esci}
      </Pulsante>
      {uscita.isError && (
        <Avviso tipo="errore" titolo={messaggi.comune.erroreRete.titolo}>
          {messaggi.comune.erroreRete.testo}
        </Avviso>
      )}
    </div>
  );
}
