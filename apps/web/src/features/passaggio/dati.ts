'use client';

import { useQuery } from '@tanstack/react-query';
import { useIo } from '@/features/amici/dati';
import { leggiServiziTrasporto } from './api';

const UN_GIORNO = 24 * 60 * 60 * 1000;

/**
 * Elenco dei servizi di trasporto. Cambia di rado: resta valido un giorno e, con la cache
 * salvata sul telefono, i numeri dei taxi si leggono anche senza rete.
 */
export function useServiziTrasporto() {
  const io = useIo();
  return useQuery({
    queryKey: ['passaggio', 'servizi', io ?? ''],
    queryFn: leggiServiziTrasporto,
    enabled: io !== null,
    staleTime: UN_GIORNO,
    gcTime: 7 * UN_GIORNO,
  });
}
