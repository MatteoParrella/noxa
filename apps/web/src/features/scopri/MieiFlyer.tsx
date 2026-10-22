'use client';

import { Image as ImageIcon, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/Badge';
import { Entra } from '@/components/ui/Movimento';
import { Pulsante } from '@/components/ui/Pulsante';
import { Caricamento, ElencoVuoto, ErroreConAzione } from '@/components/ui/Stati';
import { useToast } from '@/components/ui/Toast';
import { useSessione } from '@/features/account/sessione';
import { messaggi } from '@/lib/messaggi/it';
import { eliminaFlyer, leggiMieiFlyer, type StatoCaricamento } from './api-flyer';

const testi = messaggi.scopri.mieiFlyer;

const VARIANTI_STATO: Record<
  StatoCaricamento,
  'neutro' | 'accento' | 'avviso' | 'successo' | 'errore'
> = {
  caricato: 'neutro',
  in_analisi: 'accento',
  in_revisione: 'avviso',
  approvato: 'successo',
  unito: 'successo',
  rifiutato: 'errore',
  errore: 'errore',
};

const CHIAVI_FLYER = ['scopri', 'miei-flyer'] as const;

function formattaData(iso: string): string {
  return new Intl.DateTimeFormat('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso));
}

/** Elenco dei flyer caricati dall'utente con stato e possibilità di eliminare (F-06). */
export function MieiFlyer() {
  const sessione = useSessione();
  const io = sessione.stato === 'presente' ? sessione.utenteId : null;
  const mostraToast = useToast();
  const client = useQueryClient();

  const flyer = useQuery({
    queryKey: [...CHIAVI_FLYER, io ?? ''],
    queryFn: leggiMieiFlyer,
    enabled: io !== null,
  });

  const elimina = useMutation({
    mutationFn: ({ id, percorso }: { id: string; percorso: string }) => eliminaFlyer(id, percorso),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: CHIAVI_FLYER });
      mostraToast({ testo: testi.eliminaSuccesso });
    },
    onError: () => {
      mostraToast({ testo: testi.eliminaErrore });
    },
  });

  if (!io || flyer.isPending) {
    return <Caricamento descrizione={testi.caricamento} />;
  }

  if (flyer.isError) {
    return (
      <ErroreConAzione
        titolo={testi.errore.titolo}
        onRiprova={() => void flyer.refetch()}
        riprovaInCorso={flyer.isFetching}
      >
        {testi.errore.testo}
      </ErroreConAzione>
    );
  }

  if (flyer.data.length === 0) {
    return (
      <ElencoVuoto
        icona={ImageIcon}
        titolo={testi.vuoto.titolo}
        azione={
          <Link href="/scopri/carica-flyer/" className="btn btn-primario">
            {testi.vuoto.azione}
          </Link>
        }
      >
        {testi.vuoto.testo}
      </ElencoVuoto>
    );
  }

  return (
    <Entra>
      <div className="flex justify-end mb-4">
        <Link href="/scopri/carica-flyer/" className="btn btn-secondario btn-s">
          {testi.caricaFlyer}
        </Link>
      </div>
      <ul className="flex flex-col gap-3 list-none p-0 m-0">
        {flyer.data.map((f) => {
          const eliminabile = f.stato !== 'approvato' && f.stato !== 'unito';
          return (
            <li key={f.id} className="card flex flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1 min-w-0">
                  <time dateTime={f.creato_il} className="t-didascalia c-3">
                    {formattaData(f.creato_il)}
                  </time>
                  <Badge variante={VARIANTI_STATO[f.stato]}>{testi.stati[f.stato]}</Badge>
                </div>
                {eliminabile && (
                  <Pulsante
                    variante="testo"
                    dimensione="s"
                    aria-label={testi.elimina}
                    onClick={() => elimina.mutate({ id: f.id, percorso: f.storage_path })}
                    disabled={elimina.isPending}
                  >
                    <Trash2 aria-hidden="true" className="ico ico-s" strokeWidth={1.75} />
                  </Pulsante>
                )}
              </div>
              {f.motivo_rifiuto && (
                <p className="t-corpo-piccolo c-2 m-0">
                  <span className="font-medium">{testi.motivoRifiuto}</span> {f.motivo_rifiuto}
                </p>
              )}
              {(f.stato === 'approvato' || f.stato === 'unito') && f.evento_id && (
                <Link
                  href={`/evento/?id=${encodeURIComponent(f.evento_id)}`}
                  className="btn btn-testo btn-s self-start -ml-2"
                >
                  {testi.vaiAllevento}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </Entra>
  );
}
