'use client';

import { Capacitor } from '@capacitor/core';
import { RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Icona } from '@/components/ui/Icona';
import { Toast } from '@/components/ui/Toast';
import {
  applicaAggiornamento,
  controllaPeriodicamente,
  osservaAggiornamento,
} from '@/lib/aggiornamento';
import { messaggi } from '@/lib/messaggi/it';
import { avviaSentry } from '@/lib/sentry';

/**
 * Registra il service worker generato da Workbox dopo la build (scripts/genera-sw.mjs).
 * Solo in produzione e solo nel browser: nelle app native i file sono già nel pacchetto.
 * Quando una versione nuova è pronta mostra l'avviso «Ricarica» (lib/aggiornamento.ts).
 * In produzione avvia anche Sentry, se configurato (lib/sentry.ts).
 */
export function RegistraServiceWorker() {
  const [inAttesa, setInAttesa] = useState<ServiceWorker | null>(null);
  const [nascosto, setNascosto] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    void avviaSentry();
    if (!('serviceWorker' in navigator)) return;
    if (Capacitor.isNativePlatform()) return;

    let attivo = true;
    const pulizie: Array<() => void> = [];
    navigator.serviceWorker
      .register('/sw.js')
      .then((registrazione) => {
        if (!attivo) return;
        pulizie.push(
          osservaAggiornamento(registrazione, navigator.serviceWorker, (worker) => {
            setInAttesa(worker);
            setNascosto(false);
          }),
          controllaPeriodicamente(registrazione, document),
        );
      })
      .catch(() => {
        // Senza service worker l'app funziona lo stesso, solo senza la cache offline.
      });
    return () => {
      attivo = false;
      for (const pulisci of pulizie) pulisci();
    };
  }, []);

  if (!inAttesa || nascosto) return null;
  const testi = messaggi.comune.nuovaVersione;
  return (
    <Toast
      testo={testi.testo}
      icona={<Icona icona={RefreshCw} />}
      azione={{
        etichetta: testi.azione,
        onScegli: () =>
          applicaAggiornamento(inAttesa, navigator.serviceWorker, () => window.location.reload()),
      }}
      durata={null}
      chiudibile
      onChiudi={() => setNascosto(true)}
    />
  );
}
