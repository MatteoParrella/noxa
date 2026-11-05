'use client';

import { useRinnovaDispositivo } from './datiPush';

/** Rinnova il dispositivo push all'apertura dell'app, senza interfaccia (F-22). */
export function RinnovaDispositivo() {
  useRinnovaDispositivo();
  return null;
}
