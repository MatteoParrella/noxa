'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Caricamento, ErroreConAzione } from '@/components/ui/Stati';
import { ErroreRete, converti } from '@/lib/errori';
import { messaggi } from '@/lib/messaggi/it';
import { PERCORSI } from './documenti';
import { IllustrazioneBusta } from './Illustrazioni';
import { Schermata } from './Schermata';
import { CHIAVE_ACCOUNT } from './sessione';
import { VerificaEmail } from './VerificaEmail';
import { verificaLinkUnaVolta } from './verificaLink';

type Stato = 'verifica' | 'scaduto' | 'rete';

/**
 * Pagina aperta dal link dell'email di conferma (?token_hash=…&type=email). Dopo la verifica
 * l'utente ha una sessione e passa all'onboarding di sicurezza.
 */
export function ConfermaEmail() {
  const router = useRouter();
  const parametri = useSearchParams();
  const client = useQueryClient();
  const tokenHash = parametri.get('token_hash');
  const [stato, setStato] = useState<Stato>('verifica');

  const verifica = useCallback(() => {
    if (!tokenHash) {
      router.replace(PERCORSI.accesso);
      return;
    }
    verificaLinkUnaVolta(tokenHash, 'email')
      .then(async () => {
        await client.invalidateQueries({ queryKey: [CHIAVE_ACCOUNT] });
        router.replace(PERCORSI.sicurezza);
      })
      .catch((errore: unknown) => {
        // Senza rete si riprova; un link scaduto, già usato o alterato chiede un nuovo link.
        setStato(converti(errore) instanceof ErroreRete ? 'rete' : 'scaduto');
      });
  }, [tokenHash, router, client]);

  useEffect(() => {
    verifica();
  }, [verifica]);

  if (stato === 'scaduto') return <VerificaEmail scaduto />;

  const testi = messaggi.verifica;
  return (
    <Schermata
      illustrazione={<IllustrazioneBusta />}
      etichetta={testi.etichettaSezione}
      titolo={testi.titoloInCorso}
    >
      {stato === 'verifica' ? (
        <Caricamento descrizione={testi.titoloInCorso} righe={1} />
      ) : (
        <ErroreConAzione
          titolo={messaggi.comune.erroreRete.titolo}
          onRiprova={() => {
            setStato('verifica');
            verifica();
          }}
        >
          {messaggi.comune.erroreRete.testo}
        </ErroreConAzione>
      )}
    </Schermata>
  );
}
