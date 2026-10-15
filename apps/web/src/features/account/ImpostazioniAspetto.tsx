'use client';

import { useSyncExternalStore } from 'react';
import { Interruttore } from '@/components/ui/Interruttore';
import { applicaTema, EVENTO_TEMA, temaAttivo, type Tema } from '@/lib/tema';

function iscrivi(avvisa: () => void) {
  window.addEventListener(EVENTO_TEMA, avvisa);
  return () => window.removeEventListener(EVENTO_TEMA, avvisa);
}

/** Scelta del tema: scuro predefinito, chiaro a richiesta. */
export function ImpostazioniAspetto() {
  const tema = useSyncExternalStore<Tema>(iscrivi, temaAttivo, () => 'scuro');
  return (
    <Interruttore
      etichetta="Tema chiaro"
      descrizione="Di sera il tema scuro affatica meno la vista."
      attivo={tema === 'chiaro'}
      onCambia={(chiaro) => applicaTema(chiaro ? 'chiaro' : 'scuro')}
    />
  );
}
