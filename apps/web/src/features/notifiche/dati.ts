'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSessione } from '@/features/account/sessione';
import { supabase } from '@/lib/supabase';
import { leggiNotifiche } from './api';

export const CHIAVI = {
  notifiche: ['notifiche'] as const,
  mie: (io: string) => ['notifiche', 'mie', io] as const,
};

export function useIo(): string | null {
  const sessione = useSessione();
  return sessione.stato === 'presente' ? sessione.utenteId : null;
}

/**
 * Notifiche dell'utente con sottoscrizione Realtime: ogni nuova notifica inserita
 * nel database invalida la cache e aggiorna il contatore della campanella.
 */
export function useNotifiche() {
  const io = useIo();
  const client = useQueryClient();

  useEffect(() => {
    if (!io) return;
    const channel = supabase()
      .channel(`notifiche-${io}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifiche',
          filter: `utente_id=eq.${io}`,
        },
        () => {
          void client.invalidateQueries({ queryKey: CHIAVI.mie(io) });
        },
      )
      .subscribe();
    return () => {
      void supabase().removeChannel(channel);
    };
  }, [io, client]);

  return useQuery({
    queryKey: CHIAVI.mie(io ?? ''),
    queryFn: leggiNotifiche,
    enabled: io !== null,
  });
}

/** Numero di notifiche non ancora lette; 0 se i dati non sono ancora disponibili. */
export function useConteggioNonLette(): number {
  const { data } = useNotifiche();
  if (!data) return 0;
  return data.filter((n) => n.letta_il === null).length;
}
