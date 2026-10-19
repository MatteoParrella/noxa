'use client';

import { CircleCheck, Clock, Flag, Send } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Icona } from '@/components/ui/Icona';
import { Caricamento, ElencoVuoto, ErroreConAzione } from '@/components/ui/Stati';
import { messaggi } from '@/lib/messaggi/it';
import type { MiaSegnalazione } from './api';
import { useMieSegnalazioni } from './dati';

const testi = messaggi.mieSegnalazioni;

const ICONE_STATO = { aperta: Send, in_lavorazione: Clock, chiusa: CircleCheck } as const;

function giorno(iso: string): string {
  return new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
    .format(new Date(iso))
    .replaceAll('/', '.');
}

function motivo(valore: string): string {
  return messaggi.segnala.motivi.find((voce) => voce.valore === valore)?.etichetta ?? valore;
}

/** Le proprie segnalazioni con lo stato e la decisione motivata (DSA art. 17). */
export function MieSegnalazioni() {
  const segnalazioni = useMieSegnalazioni();
  if (segnalazioni.isPending) return <Caricamento descrizione={testi.caricamento} />;
  if (segnalazioni.isError) {
    return (
      <ErroreConAzione
        titolo={messaggi.comune.erroreRete.titolo}
        onRiprova={() => void segnalazioni.refetch()}
        riprovaInCorso={segnalazioni.isFetching}
      >
        {messaggi.comune.erroreRete.testo}
      </ErroreConAzione>
    );
  }
  if (segnalazioni.data.length === 0) {
    return (
      <ElencoVuoto icona={Flag} titolo={testi.vuoto.titolo}>
        {testi.vuoto.testo}
      </ElencoVuoto>
    );
  }
  return (
    <ul className="m-0 list-none p-0">
      {segnalazioni.data.map((voce) => (
        <Voce key={voce.id} voce={voce} />
      ))}
    </ul>
  );
}

/** Cosa è stato segnalato, con il nome che chi segnala conosceva già. */
function descrizioneOggetto(voce: MiaSegnalazione): string {
  const { oggetto } = testi;
  switch (voce.tipo_oggetto) {
    case 'profilo':
      return voce.descrizione ? `${oggetto.profilo} ${voce.descrizione}` : oggetto.profiloRimosso;
    case 'evento':
      return voce.descrizione ? `${oggetto.evento} «${voce.descrizione}»` : oggetto.eventoRimosso;
    case 'immagine_locale':
      return voce.descrizione
        ? `${oggetto.immagine_locale} ${voce.descrizione}`
        : oggetto.immagineRimossa;
    default:
      return voce.descrizione ?? voce.tipo_oggetto;
  }
}

function Voce({ voce }: { voce: MiaSegnalazione }) {
  const cosa = descrizioneOggetto(voce);
  return (
    <li className="segn">
      <div className="segn-testa">
        <span className="segn-cosa">{cosa}</span>
        <Badge variante={voce.stato === 'chiusa' ? 'successo' : 'tenue'}>
          <Icona icona={ICONE_STATO[voce.stato]} dimensione="s" />
          {testi.stati[voce.stato]}
        </Badge>
      </div>
      <span className="segn-meta">
        {motivo(voce.motivo)} · {giorno(voce.creata_il)}
      </span>
      {voce.decisione && voce.decisa_il && (
        <div className="decisione">
          <span className="segn-meta">
            {testi.decisione} {giorno(voce.decisa_il)} · {testi.dsa}
          </span>
          <p className="m-0">{voce.decisione}</p>
          <p className="t-didascalia c-2 m-0">{testi.persona}</p>
        </div>
      )}
    </li>
  );
}
