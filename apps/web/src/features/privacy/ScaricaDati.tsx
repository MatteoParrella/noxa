'use client';

import { useMutation } from '@tanstack/react-query';
import {
  BookOpen,
  Braces,
  CalendarCheck,
  Check,
  Download,
  Flag,
  User,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Avviso } from '@/components/ui/Avviso';
import { Icona } from '@/components/ui/Icona';
import { Pulsante } from '@/components/ui/Pulsante';
import { useOnline } from '@/lib/connessione';
import { dataIso, oggiARoma } from '@/lib/date';
import { messaggi } from '@/lib/messaggi/it';
import { esportaDati, type Esportazione } from './api';

const testi = messaggi.privacy.scarica;

const VOCI: { chiave: keyof typeof testi.voci; icona: LucideIcon }[] = [
  { chiave: 'profilo', icona: User },
  { chiave: 'amicizie', icona: Users },
  { chiave: 'gruppi', icona: UsersRound },
  { chiave: 'partecipazioni', icona: CalendarCheck },
  { chiave: 'diario', icona: BookOpen },
  { chiave: 'segnalazioni', icona: Flag },
  { chiave: 'consensi', icona: Check },
];

const oraBreve = (data: Date) =>
  new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome',
    hour: '2-digit',
    minute: '2-digit',
  }).format(data);

/**
 * Scarica i tuoi dati (design/F-42-privacy §2, R-64): il file JSON si prepara nel database e
 * si salva sul dispositivo, senza email né link pubblici. Una richiesta all'ora.
 */
export function ScaricaDati() {
  const online = useOnline();
  const prepara = useMutation({ mutationFn: esportaDati });
  const [file, setFile] = useState<{ url: string; nome: string; kb: number } | null>(null);

  // Il link al file vive solo in memoria e si libera quando si lascia la pagina.
  useEffect(
    () => () => {
      if (file) URL.revokeObjectURL(file.url);
    },
    [file],
  );

  const avvia = () =>
    prepara.mutate(undefined, {
      onSuccess: (esito: Esportazione) => {
        if (esito.stato !== 'pronto') return;
        const blob = new Blob([esito.contenuto], { type: 'application/json' });
        setFile({
          url: URL.createObjectURL(blob),
          nome: testi.nomeFile(dataIso(oggiARoma())),
          kb: esito.byte / 1024,
        });
      },
    });

  const limite = prepara.data?.stato === 'limite' ? prepara.data.prossima : null;

  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="pv-contenuto">
        <h2 className="etichetta-riga etichetta mt-0 mb-2" id="pv-contenuto">
          {testi.contenuto}
        </h2>
        <ul className="pv-contenuto">
          {VOCI.map(({ chiave, icona }) => (
            <li key={chiave}>
              <Icona icona={icona} />
              {testi.voci[chiave]}
            </li>
          ))}
        </ul>
        <p className="pv-nota mt-3">
          <Icona icona={Braces} />
          {testi.formato}
        </p>
      </section>

      <div className="pv-riquadro" aria-live="polite">
        {file ? (
          <>
            <p className="ri-ero-titolo m-0">
              <Icona icona={Check} />
              {testi.pronto}
            </p>
            <span className="sr-only">{testi.annuncioPronto}</span>
            <div className="pv-file">
              <span className="pv-file-icona" aria-hidden="true">
                JSON
              </span>
              <span className="min-w-0">
                <b>{file.nome}</b>
                <small>{testi.dimensione(file.kb)}</small>
              </span>
            </div>
            <a className="btn btn-principale btn-pieno" href={file.url} download={file.nome}>
              <Icona icona={Download} dimensione="s" />
              {testi.scarica}
            </a>
            <p className="t-corpo-s c-2 m-0">{testi.prontoAiuto}</p>
          </>
        ) : prepara.isPending ? (
          <>
            <p className="m-0 flex justify-between gap-2" role="status">
              <span>{testi.preparazione}</span>
              <span className="mono c-2" aria-hidden="true">
                JSON
              </span>
            </p>
            <div className="pv-barra" aria-hidden="true">
              <span />
            </div>
            <p className="t-corpo-s c-2 m-0">{testi.preparazioneAiuto}</p>
          </>
        ) : (
          <>
            {!online && (
              <Avviso tipo="avviso" titolo={testi.offline.titolo}>
                {testi.offline.testo}
              </Avviso>
            )}
            {online && prepara.isError && (
              <Avviso tipo="errore" titolo={testi.errore.titolo}>
                {testi.errore.testo}
              </Avviso>
            )}
            {limite && (
              <Avviso
                tipo="info"
                titolo={testi.limite.titolo(oraBreve(new Date(limite.getTime() - 3600_000)))}
              >
                {testi.limite.testo(oraBreve(limite))}
              </Avviso>
            )}
            <Pulsante
              variante="principale"
              pieno
              disabled={!online || limite !== null}
              onClick={avvia}
            >
              {prepara.isError ? messaggi.comune.riprova : testi.prepara}
            </Pulsante>
            <p className="t-corpo-s c-2 m-0">{testi.regola}</p>
          </>
        )}
      </div>
    </div>
  );
}
