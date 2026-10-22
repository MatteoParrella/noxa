'use client';

import { useQuery } from '@tanstack/react-query';
import { converti } from '@/lib/errori';
import { supabase } from '@/lib/supabase';

/** Durata degli URL firmati delle foto profilo: la cache li rinnova prima della scadenza. */
const DURATA_URL_SECONDI = 3600;

/** Chiave della cache degli URL firmati, per percorso nel bucket `avatar`. */
export const CHIAVE_URL_AVATAR = 'avatar-url';

/**
 * URL firmato per mostrare una foto profilo. Lo storage applica la visibilità del profilo
 * (R-13, R-52): una foto nascosta o non visibile dà errore e l'avatar resta con le iniziali.
 */
export async function urlAvatar(percorso: string): Promise<string> {
  const { data, error } = await supabase()
    .storage.from('avatar')
    .createSignedUrl(percorso, DURATA_URL_SECONDI);
  if (error) throw converti(error);
  return data.signedUrl;
}

/** URL della foto profilo, o null finché non c'è (nessuna foto, caricamento, errore). */
export function useUrlAvatar(percorso: string | null | undefined): string | null {
  const query = useQuery({
    queryKey: [CHIAVE_URL_AVATAR, percorso ?? ''],
    queryFn: () => urlAvatar(percorso!),
    enabled: !!percorso,
    staleTime: (DURATA_URL_SECONDI - 300) * 1000,
    gcTime: (DURATA_URL_SECONDI - 300) * 1000,
    retry: false,
  });
  return percorso ? (query.data ?? null) : null;
}
