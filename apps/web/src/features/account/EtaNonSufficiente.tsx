'use client';

import { Rivela } from '@/components/ui/Movimento';
import { Pulsante } from '@/components/ui/Pulsante';
import { messaggi } from '@/lib/messaggi/it';
import { IllustrazioneOrizzonte } from './Illustrazioni';
import { Schermata } from './Schermata';

/**
 * Chi ha meno di 14 anni (R-01). Un solo pulsante e nessun modo di cambiare la data, per non
 * suggerire di mentire; i dati scritti sono già stati cancellati dal modulo.
 */
export function EtaNonSufficiente({ onHoCapito }: { onHoCapito: () => void }) {
  const testi = messaggi.eta;
  return (
    <Schermata
      illustrazione={<IllustrazioneOrizzonte />}
      etichetta={testi.etichettaSezione}
      titolo={testi.titolo}
      piede={
        <Pulsante variante="principale" dimensione="l" pieno onClick={onHoCapito}>
          {testi.hoCapito}
        </Pulsante>
      }
    >
      <Rivela className="schermo-pila" indice={2}>
        <p className="testo-accesso is-primario">{testi.testo}</p>
        <p className="testo-accesso">{testi.nienteSalvato}</p>
      </Rivela>
    </Schermata>
  );
}
