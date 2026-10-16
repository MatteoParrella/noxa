'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Avviso } from '@/components/ui/Avviso';
import { IndicatorePunti } from '@/components/ui/Indicatori';
import { Entra } from '@/components/ui/Movimento';
import { Pulsante } from '@/components/ui/Pulsante';
import { Caricamento, ErroreConAzione } from '@/components/ui/Stati';
import { messaggi } from '@/lib/messaggi/it';
import { completaOnboarding } from './api';
import { PERCORSI } from './documenti';
import {
  IllustrazioneCerchie,
  IllustrazionePosizione,
  IllustrazioneSegnala,
} from './Illustrazioni';
import { Schermata } from './Schermata';
import { CHIAVE_ACCOUNT, useMioAccount, useSessione } from './sessione';

const ILLUSTRAZIONI = [IllustrazioneCerchie, IllustrazionePosizione, IllustrazioneSegnala] as const;

/**
 * Onboarding di sicurezza: tre schermate, una sola volta dopo la prima verifica, senza
 * "Salta" (F-10). La prima cambia per chi ha 14–17 anni e per chi è maggiorenne: la fascia
 * arriva dal database (mio_account), mai da un calcolo nel client (R-04).
 */
export function OnboardingSicurezza() {
  const router = useRouter();
  const client = useQueryClient();
  const sessione = useSessione();
  const account = useMioAccount(sessione);
  const [schermata, setSchermata] = useState(1);
  const testi = messaggi.onboarding;

  const giaCompletato = account.data?.onboarding_completato === true;
  useEffect(() => {
    if (sessione.stato === 'assente') router.replace(PERCORSI.benvenuto);
    // Una sola volta: chi l'ha già visto (o lo ha appena finito) va nell'app.
    else if (giaCompletato) router.replace(PERCORSI.home);
  }, [sessione, giaCompletato, router]);

  const fine = useMutation({
    mutationFn: async () => {
      if (sessione.stato !== 'presente') return;
      await completaOnboarding(sessione.utenteId);
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: [CHIAVE_ACCOUNT] });
      router.replace(PERCORSI.home);
    },
  });

  if (sessione.stato !== 'presente' || account.isPending) {
    return (
      <Schermata>
        <Caricamento descrizione={messaggi.comune.caricamentoAccount} />
      </Schermata>
    );
  }

  if (account.isError || !account.data) {
    return (
      <Schermata>
        <ErroreConAzione
          titolo={messaggi.comune.erroreRete.titolo}
          onRiprova={() => void account.refetch()}
          riprovaInCorso={account.isFetching}
        >
          {messaggi.comune.erroreRete.testo}
        </ErroreConAzione>
      </Schermata>
    );
  }

  const contenuto = testi.schermate[schermata - 1]!;
  const frasi =
    'tutti' in contenuto
      ? contenuto.tutti
      : account.data.minorenne
        ? contenuto.minorenne
        : contenuto.maggiorenne;
  const Illustrazione = ILLUSTRAZIONI[schermata - 1]!;
  const ultima = schermata === testi.schermate.length;

  return (
    <Schermata
      key={schermata}
      illustrazione={<Illustrazione />}
      etichetta={contenuto.etichetta}
      titolo={contenuto.titolo}
      piedeSenzaFilo
      piede={
        <div className="flex flex-col gap-4">
          <IndicatorePunti
            attuale={schermata}
            totale={testi.schermate.length}
            etichetta={testi.schermataAccessibile(schermata)}
          />
          <Pulsante
            variante="principale"
            dimensione="l"
            pieno
            caricamento={fine.isPending}
            disabled={fine.isPending}
            onClick={() => (ultima ? fine.mutate() : setSchermata(schermata + 1))}
          >
            {ultima ? testi.fine : testi.avanti}
          </Pulsante>
        </div>
      }
    >
      <Entra className="flex flex-col gap-3" indice={2}>
        {frasi.map((frase) => (
          <p key={frase} className="testo-accesso is-primario t-corpo">
            {frase}
          </p>
        ))}
        {fine.isError && (
          <Avviso tipo="errore" titolo={messaggi.comune.erroreRete.titolo}>
            {messaggi.comune.erroreRete.testo}
          </Avviso>
        )}
      </Entra>
    </Schermata>
  );
}
