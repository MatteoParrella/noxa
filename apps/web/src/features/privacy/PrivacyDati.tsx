'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Ban,
  ChevronRight,
  Download,
  FileText,
  Pencil,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Avviso } from '@/components/ui/Avviso';
import { Icona } from '@/components/ui/Icona';
import { Interruttore } from '@/components/ui/Interruttore';
import { Entra } from '@/components/ui/Movimento';
import { Pulsante } from '@/components/ui/Pulsante';
import { Caricamento, ErroreConAzione } from '@/components/ui/Stati';
import { useToast } from '@/components/ui/Toast';
import { useBloccati, useIo } from '@/features/amici/dati';
import { CHIAVI as CHIAVI_EVENTI, useVisibilitaPredefinita } from '@/features/scopri/dati';
import { useOnline } from '@/lib/connessione';
import { messaggi } from '@/lib/messaggi/it';
import { salvaPartecipazioniVisibili } from './api';

const testi = messaggi.privacy.pagina;

/** Profilo › Privacy e dati (design/F-42-privacy §1). */
export function PrivacyDati() {
  const io = useIo();
  const online = useOnline();
  const visibili = useVisibilitaPredefinita();
  const bloccati = useBloccati();

  if (!io || visibili.isPending) return <Caricamento descrizione={testi.caricamento} righe={4} />;
  if (visibili.isError) {
    return (
      <ErroreConAzione
        titolo={testi.errore.titolo}
        onRiprova={() => void visibili.refetch()}
        riprovaInCorso={visibili.isFetching}
      >
        {testi.errore.testo}
      </ErroreConAzione>
    );
  }

  return (
    <div className="flex flex-col">
      <Entra indice={1}>
        <section className="pv-sezione" aria-labelledby="pv-chi-vede">
          <h2 className="etichetta" id="pv-chi-vede">
            {testi.chiVedeCosa}
          </h2>
          <Partecipazioni io={io} attivo={visibili.data} online={online} />
          <RigaNavigazione
            href="/profilo/bloccati/"
            icona={Ban}
            titolo={testi.bloccati}
            testo={testi.bloccatiTesto}
            valore={bloccati.data ? String(bloccati.data.length) : undefined}
            valoreLettura={
              bloccati.data ? testi.bloccatiConteggio(bloccati.data.length) : undefined
            }
          />
        </section>
      </Entra>
      <Entra indice={2}>
        <section className="pv-sezione" aria-labelledby="pv-dati">
          <h2 className="etichetta" id="pv-dati">
            {testi.tuoiDati}
          </h2>
          <RigaNavigazione
            href="/profilo/privacy/scarica/"
            icona={Download}
            titolo={testi.scarica}
            testo={testi.scaricaTesto}
          />
          <RigaNavigazione
            href="/profilo/privacy/informativa/"
            icona={FileText}
            titolo={testi.informativa}
            testo={testi.informativaTesto}
          />
        </section>
      </Entra>
      <Entra indice={3}>
        <section className="pv-sezione account" aria-labelledby="pv-account">
          <h2 className="etichetta" id="pv-account">
            {testi.account}
          </h2>
          <RigaNavigazione
            href="/profilo/privacy/elimina/"
            icona={Trash2}
            titolo={testi.elimina}
            testo={testi.eliminaTesto}
            pericolo
          />
        </section>
      </Entra>
    </div>
  );
}

/**
 * Interruttore delle partecipazioni (R-67): l'aggiornamento è ottimista e, se il salvataggio
 * non riesce, torna com'era con un avviso. Offline resta visibile ma non si cambia.
 */
function Partecipazioni({ io, attivo, online }: { io: string; attivo: boolean; online: boolean }) {
  const client = useQueryClient();
  const mostraToast = useToast();
  const chiave = CHIAVI_EVENTI.visibilita(io);
  const [fallito, setFallito] = useState<boolean | null>(null);
  const salva = useMutation({
    mutationFn: (nuovo: boolean) => salvaPartecipazioniVisibili(io, nuovo),
    onMutate: async (nuovo) => {
      setFallito(null);
      await client.cancelQueries({ queryKey: chiave });
      client.setQueryData(chiave, nuovo);
      return { prima: !nuovo };
    },
    onError: (_errore, _nuovo, contesto) => {
      if (contesto) {
        client.setQueryData(chiave, contesto.prima);
        setFallito(contesto.prima);
      }
    },
    onSuccess: () => mostraToast({ testo: testi.salvato }),
    onSettled: () => void client.invalidateQueries({ queryKey: CHIAVI_EVENTI.eventi }),
  });

  return (
    <div className="pv-impostazione">
      {fallito !== null && (
        <Avviso
          tipo="errore"
          titolo={testi.salvataggio.titolo}
          portaInVista
          azioni={
            <Pulsante variante="secondario" dimensione="s" onClick={() => salva.mutate(!fallito)}>
              {messaggi.comune.riprova}
            </Pulsante>
          }
        >
          {testi.salvataggio.testo(fallito)}
        </Avviso>
      )}
      <Interruttore
        etichetta={testi.partecipazioni}
        descrizione={attivo ? testi.partecipazioniAcceso : testi.partecipazioniSpento}
        attivo={attivo}
        disabled={!online || salva.isPending}
        onCambia={(nuovo) => salva.mutate(nuovo)}
      />
      <p className="pv-nota">
        <Icona icona={Pencil} />
        {online ? testi.perEvento : testi.perEventoOffline}
      </p>
    </div>
  );
}

function RigaNavigazione({
  href,
  icona,
  titolo,
  testo,
  valore,
  valoreLettura,
  pericolo = false,
}: {
  href: string;
  icona: LucideIcon;
  titolo: string;
  testo: string;
  valore?: string | undefined;
  valoreLettura?: string | undefined;
  pericolo?: boolean;
}) {
  return (
    <Link className={pericolo ? 'pv-riga pericolo' : 'pv-riga'} href={href}>
      <Icona icona={icona} />
      <span className="min-w-0">
        <b>{titolo}</b>
        <small>{testo}</small>
      </span>
      <span className="valore">
        {valore !== undefined && (
          <>
            <span aria-hidden="true">{valore}</span>
            {valoreLettura && <span className="sr-only">{valoreLettura}</span>}
          </>
        )}
        <Icona icona={ChevronRight} dimensione="s" />
      </span>
    </Link>
  );
}
