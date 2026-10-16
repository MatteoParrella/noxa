'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, type ReactNode } from 'react';
import { Caricamento } from '@/components/ui/Stati';
import { messaggi } from '@/lib/messaggi/it';
import { ricordaPaginaDopoAccesso } from './dopoAccesso';
import { PERCORSI } from './documenti';
import { FoglioNuoviTermini } from './FoglioNuoviTermini';
import { useMioAccount, useSessione } from './sessione';

/**
 * Le aree dell'app richiedono un account (R-07). Il controllo qui serve solo all'esperienza
 * d'uso: senza sessione la RLS non restituisce comunque nulla (ADR-0002).
 */
export function ProtezioneAccount({ children }: { children: ReactNode }) {
  const router = useRouter();
  const sessione = useSessione();
  const account = useMioAccount(sessione);

  const daOnboarding = account.data?.onboarding_completato === false;
  // Una sessione c'è stata in questa pagina: se sparisce è un'uscita, non un link da riaprire.
  const eraPresente = useRef(false);
  useEffect(() => {
    if (sessione.stato === 'presente') eraPresente.current = true;
  }, [sessione.stato]);
  useEffect(() => {
    if (sessione.stato === 'assente') {
      // Un link aperto senza sessione (per esempio un invito) si riapre dopo l'accesso.
      if (!eraPresente.current) {
        ricordaPaginaDopoAccesso(window.location.pathname + window.location.search);
      }
      router.replace(PERCORSI.benvenuto);
    } else if (daOnboarding) router.replace(PERCORSI.sicurezza);
  }, [sessione.stato, daOnboarding, router]);

  if (sessione.stato !== 'presente' || (account.isPending && account.fetchStatus !== 'idle')) {
    return (
      <div className="pagina pt-8">
        <Caricamento descrizione={messaggi.comune.caricamentoAccount} />
      </div>
    );
  }
  if (daOnboarding) return null;

  // Senza rete l'app resta usabile con i dati in cache; il controllo si ripete al ritorno.
  const documenti = account.data?.documenti_da_accettare ?? [];
  return (
    <>
      {children}
      {documenti.length > 0 && (
        <FoglioNuoviTermini utenteId={sessione.utenteId} documenti={documenti} />
      )}
    </>
  );
}
