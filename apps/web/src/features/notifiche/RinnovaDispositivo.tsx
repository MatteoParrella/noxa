'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useRinnovaDispositivo } from './datiPush';
import { EVENTO_APRI_NOTIFICA } from './pushNativo';

/**
 * Rinnova il dispositivo push all'apertura dell'app, senza interfaccia (F-22). Nell'app Android
 * apre la notifica toccata nella barra del sistema (ADR-0027).
 */
export function RinnovaDispositivo() {
  useRinnovaDispositivo();
  const router = useRouter();
  useEffect(() => {
    function apri(evento: Event) {
      const id = (evento as CustomEvent<unknown>).detail;
      if (typeof id === 'string') router.push(`/notifiche/?apri=${id}`);
    }
    window.addEventListener(EVENTO_APRI_NOTIFICA, apri);
    return () => window.removeEventListener(EVENTO_APRI_NOTIFICA, apri);
  }, [router]);
  return null;
}
