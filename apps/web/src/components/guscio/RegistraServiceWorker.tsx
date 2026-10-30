'use client';

import { Capacitor } from '@capacitor/core';
import { useEffect } from 'react';
import { avviaSentry } from '@/lib/sentry';

/**
 * Registra il service worker generato da Workbox dopo la build (scripts/genera-sw.mjs).
 * Solo in produzione e solo nel browser: nelle app native i file sono già nel pacchetto.
 * In produzione avvia anche Sentry, se configurato (lib/sentry.ts).
 */
export function RegistraServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    void avviaSentry();
    if (!('serviceWorker' in navigator)) return;
    if (Capacitor.isNativePlatform()) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Senza service worker l'app funziona lo stesso, solo senza la cache offline.
    });
  }, []);
  return null;
}
