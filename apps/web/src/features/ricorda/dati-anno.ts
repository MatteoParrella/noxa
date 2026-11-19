'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useIo } from '@/features/amici/dati';
import { aggiornaRiepilogo, leggiBadge, leggiRiepiloghi, leggiStatistiche } from './api-anno';

/**
 * Chiavi sotto il prefisso `diario`: si salvano sul dispositivo per l'offline insieme al diario
 * (cacheLocale.ts) e si rileggono a ogni scrittura nel diario.
 */
export const CHIAVI_ANNO = {
  statistiche: (io: string, anno: number | null) =>
    ['diario', 'statistiche', io, anno ?? 'sempre'] as const,
  badge: (io: string) => ['diario', 'badge', io] as const,
  riepiloghi: (io: string) => ['diario', 'riepiloghi', io] as const,
};

export function useStatistiche(anno: number | null) {
  const io = useIo();
  return useQuery({
    queryKey: CHIAVI_ANNO.statistiche(io ?? '', anno),
    queryFn: () => leggiStatistiche(anno),
    enabled: io !== null,
  });
}

export function useBadge() {
  const io = useIo();
  return useQuery({
    queryKey: CHIAVI_ANNO.badge(io ?? ''),
    queryFn: leggiBadge,
    enabled: io !== null,
  });
}

export function useRiepiloghi() {
  const io = useIo();
  return useQuery({
    queryKey: CHIAVI_ANNO.riepiloghi(io ?? ''),
    queryFn: leggiRiepiloghi,
    enabled: io !== null,
  });
}

export function useAggiornaRiepilogo() {
  const io = useIo();
  const client = useQueryClient();
  return useMutation({
    mutationFn: aggiornaRiepilogo,
    onSettled: () => void client.invalidateQueries({ queryKey: CHIAVI_ANNO.riepiloghi(io ?? '') }),
  });
}
