'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Avviso } from '@/components/ui/Avviso';
import { Icona } from '@/components/ui/Icona';
import { Pulsante } from '@/components/ui/Pulsante';
import { useIo } from '@/features/amici/dati';
import { svuotaCoda } from '@/features/ricorda/coda';
import { cancellaCacheLocale } from '@/lib/cacheLocale';
import { messaggi } from '@/lib/messaggi/it';
import { registraErrore } from '@/lib/registro';
import { esci } from './api';
import { PERCORSI } from './documenti';

/**
 * Uscita dall'account su questo dispositivo: cancella la sessione, i dati in memoria, quelli
 * salvati per l'offline e la coda del diario (ARCHITECTURE.md §5.5).
 */
export function PulsanteEsci() {
  const router = useRouter();
  const client = useQueryClient();
  const io = useIo();
  const uscita = useMutation({
    mutationFn: async () => {
      await esci();
      try {
        await Promise.all([cancellaCacheLocale(), io ? svuotaCoda(io) : Promise.resolve()]);
      } catch (errore) {
        registraErrore("pulizia all'uscita", errore);
      }
    },
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
