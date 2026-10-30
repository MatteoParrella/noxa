'use client';

import { useCallback } from 'react';
import { useToast } from '@/components/ui/Toast';
import { messaggi } from '@/lib/messaggi/it';
import { useSincronizzaDiario } from './dati';

/**
 * Invia la coda del diario al ritorno della connessione, da qualsiasi area (ARCHITECTURE.md
 * §5.5). Montato una volta nel guscio delle aree; l'esito arriva con un toast.
 */
export function SincronizzaDiario() {
  const mostraToast = useToast();
  const avvisa = useCallback(
    (numero: number) => mostraToast({ testo: messaggi.ricorda.sincronizzazione.inviate(numero) }),
    [mostraToast],
  );
  useSincronizzaDiario(avvisa);
  return null;
}
