'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Ban, Flag, UserMinus } from 'lucide-react';
import { useState } from 'react';
import { Icona } from '@/components/ui/Icona';
import { MenuAzioni, type VoceMenu } from '@/components/ui/MenuAzioni';
import { useToast } from '@/components/ui/Toast';
import { registraErrore } from '@/lib/registro';
import { messaggi } from '@/lib/messaggi/it';
import { blocca, eliminaAmicizia, sblocca, type Persona } from './api';
import { CHIAVI } from './dati';
import { FoglioConferma } from './FoglioConferma';
import { FoglioSegnala } from './FoglioSegnala';

type Props = {
  io: string;
  persona: Persona;
  /** Presente se siete amici: abilita "Rimuovi dall'elenco". */
  amiciziaId?: string | undefined;
  /** Dopo un blocco, per esempio per lasciare il profilo che non si vede più. */
  onBloccata?: () => void;
};

type Aperto = 'rimuovi' | 'blocca' | 'segnala' | null;

/**
 * Menu ⋯ di una persona con i fogli di rimozione, blocco (R-17) e segnalazione (R-50) e il
 * toast "Persona bloccata" con "Annulla".
 */
export function AzioniPersona({ io, persona, amiciziaId, onBloccata }: Props) {
  const client = useQueryClient();
  const [aperto, setAperto] = useState<Aperto>(null);
  const mostraToast = useToast();
  const testi = messaggi.amici;

  const aggiorna = () => client.invalidateQueries({ queryKey: CHIAVI.relazioni });

  const bloccata = () => {
    setAperto(null);
    mostraToast({
      testo: messaggi.blocca.fatto,
      icona: <Icona icona={Ban} />,
      azione: {
        etichetta: testi.annulla,
        onScegli: () => {
          sblocca(io, persona.id)
            .then(aggiorna)
            .catch((errore: unknown) => registraErrore('annullamento del blocco', errore));
        },
      },
    });
    void aggiorna();
    onBloccata?.();
  };

  const voci: VoceMenu[] = [
    ...(amiciziaId
      ? [
          {
            etichetta: testi.rimuovi,
            icona: <Icona icona={UserMinus} />,
            onScegli: () => setAperto('rimuovi'),
          },
        ]
      : []),
    {
      etichetta: testi.segnala,
      icona: <Icona icona={Flag} />,
      onScegli: () => setAperto('segnala'),
      separata: Boolean(amiciziaId),
    },
    {
      etichetta: testi.blocca,
      icona: <Icona icona={Ban} />,
      onScegli: () => setAperto('blocca'),
      pericolo: true,
    },
  ];

  return (
    <>
      <MenuAzioni
        etichetta={testi.altreAzioni(persona.username)}
        titolo={`@${persona.username}`}
        voci={voci}
      />
      {aperto === 'rimuovi' && amiciziaId && (
        <FoglioConferma
          titolo={testi.rimuoviTitolo(persona.username)}
          testo={testi.rimuoviTesto}
          conferma={testi.rimuoviConferma}
          onConferma={() => eliminaAmicizia(amiciziaId)}
          onFatto={() => {
            setAperto(null);
            void aggiorna();
          }}
          onChiudi={() => setAperto(null)}
        />
      )}
      {aperto === 'blocca' && (
        <FoglioConferma
          titolo={messaggi.blocca.titolo(persona.username)}
          testo={messaggi.blocca.testo}
          conferma={messaggi.blocca.conferma}
          pericolo
          onConferma={() => blocca(io, persona.id)}
          onFatto={bloccata}
          onChiudi={() => setAperto(null)}
        />
      )}
      {aperto === 'segnala' && (
        <FoglioSegnala
          io={io}
          persona={persona}
          onFatto={(conBlocco) => (conBlocco ? bloccata() : setAperto(null))}
          onChiudi={() => setAperto(null)}
        />
      )}
    </>
  );
}
