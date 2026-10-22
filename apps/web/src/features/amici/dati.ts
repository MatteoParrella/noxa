'use client';

import { useQuery } from '@tanstack/react-query';
import { useSessione } from '@/features/account/sessione';
import { leggiAmici, leggiPersona, mieiBloccati, mieSegnalazioni } from './api';
import { leggiAvatarPath } from './api-avatar';

/** Chiave stabile per le segnalazioni, usata anche da FoglioReclamo per l'invalidazione. */
export const CHIAVE_SEGNALAZIONI = ['segnalazioni'] as const;

/** Chiavi della cache: ogni azione che cambia le relazioni invalida `CHIAVI.relazioni`. */
export const CHIAVI = {
  relazioni: ['relazioni'] as const,
  amici: (io: string) => ['relazioni', 'amici', io] as const,
  persona: (io: string, id: string) => ['relazioni', 'persona', io, id] as const,
  bloccati: (io: string) => ['relazioni', 'bloccati', io] as const,
  segnalazioni: (io: string) => ['segnalazioni', io] as const,
};

/** Identificativo dell'utente con la sessione aperta, o null. */
export function useIo(): string | null {
  const sessione = useSessione();
  return sessione.stato === 'presente' ? sessione.utenteId : null;
}

/** Percorso della mia foto profilo: ogni modifica della foto invalida `CHIAVE_MIO_AVATAR`. */
export const CHIAVE_MIO_AVATAR = ['profili', 'avatar'] as const;

export function useMioAvatar() {
  const io = useIo();
  return useQuery({
    queryKey: [...CHIAVE_MIO_AVATAR, io ?? ''],
    queryFn: () => leggiAvatarPath(io!),
    enabled: io !== null,
  });
}

export function useAmici() {
  const io = useIo();
  return useQuery({
    queryKey: CHIAVI.amici(io ?? ''),
    queryFn: () => leggiAmici(io!),
    enabled: io !== null,
  });
}

export function usePersona(id: string | null) {
  const io = useIo();
  return useQuery({
    queryKey: CHIAVI.persona(io ?? '', id ?? ''),
    queryFn: () => leggiPersona(io!, id!),
    enabled: io !== null && id !== null,
  });
}

export function useBloccati() {
  const io = useIo();
  return useQuery({
    queryKey: CHIAVI.bloccati(io ?? ''),
    queryFn: mieiBloccati,
    enabled: io !== null,
  });
}

export function useMieSegnalazioni() {
  const io = useIo();
  return useQuery({
    queryKey: CHIAVI.segnalazioni(io ?? ''),
    queryFn: mieSegnalazioni,
    enabled: io !== null,
  });
}
