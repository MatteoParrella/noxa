'use client';

import { Calendario } from '@/components/ui/Calendario';
import { aggiungiGiorni, type DataCalendario } from '@/lib/date';
import { messaggi } from '@/lib/messaggi/it';
import { giornoBreve } from './formato';

/** Giorni avanti che si possono scegliere (la ricerca accetta al massimo 62 giorni). */
const GIORNI_AVANTI = 60;

type Props = {
  oggi: DataCalendario;
  scelta: DataCalendario | undefined;
  onChiudi: () => void;
  onConferma: (data: DataCalendario) => void;
};

/** "Scegli data" (design/F-01-scopri, tavola 02): i giorni passati sono spenti e barrati. */
export function FoglioData({ oggi, scelta, onChiudi, onConferma }: Props) {
  const testi = messaggi.scopri.calendario;
  return (
    <Calendario
      titolo={testi.titolo}
      iniziale={scelta ?? oggi}
      scelta={scelta}
      minimo={oggi}
      massimo={aggiungiGiorni(oggi, GIORNI_AVANTI)}
      annoMinimo={oggi.anno}
      testoConferma={(selezione) =>
        selezione ? testi.mostra(giornoBreve(selezione)) : messaggi.comune.mostra
      }
      onChiudi={onChiudi}
      onConferma={onConferma}
    />
  );
}
