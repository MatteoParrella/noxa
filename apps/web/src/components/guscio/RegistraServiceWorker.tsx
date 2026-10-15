'use client';

import { Capacitor } from '@capacitor/core';
import { useEffect } from 'react';

/**
 * Registra il service worker generato da Workbox dopo la build (scripts/genera-sw.mjs).
 * Solo in produzione e solo nel browser: nelle app native i file sono già nel pacchetto.
 */
export function RegistraServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    if (Capacitor.isNativePlatform()) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Senza service worker l'app funziona lo stesso, solo senza la cache offline.
    });
  }, []);
  return null;
}
