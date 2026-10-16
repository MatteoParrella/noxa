'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Avviso } from '@/components/ui/Avviso';
import { CasellaLunga } from '@/components/ui/CasellaLunga';
import { Foglio } from '@/components/ui/Foglio';
import { Pulsante } from '@/components/ui/Pulsante';
import { messaggi } from '@/lib/messaggi/it';
import { accettaDocumenti, esci } from './api';
import { PERCORSI } from './documenti';
import type { DocumentoDaAccettare } from './schemi';
import { CHIAVE_ACCOUNT } from './sessione';

type Props = { utenteId: string; documenti: readonly DocumentoDaAccettare[] };

function formattaGiorno(iso: string): string {
  const [anno, mese, giorno] = iso.split('-');
  return `${giorno}.${mese}.${anno}`;
}

/**
 * Nuova versione di termini o informativa (R-63): riassunto delle novità e caselle da
 * accettare di nuovo. "Esci" e "Accetta" hanno lo stesso peso visivo (R-43).
 */
export function FoglioNuoviTermini({ utenteId, documenti }: Props) {
  const testi = messaggi.nuoviTermini;
  const router = useRouter();
  const client = useQueryClient();
  const servonoTermini = documenti.some((documento) => documento.tipo === 'termini');
  const servePrivacy = documenti.some((documento) => documento.tipo === 'privacy');
  const [termini, setTermini] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [mancanti, setMancanti] = useState(false);

  const vigore =
    documenti
      .map((documento) => documento.in_vigore_dal)
      .sort()
      .at(-1) ?? '';
  const novita = documenti.flatMap((documento) => documento.novita);

  const accetta = useMutation({
    mutationFn: () => accettaDocumenti(utenteId, documenti),
    onSuccess: () => client.invalidateQueries({ queryKey: [CHIAVE_ACCOUNT] }),
  });
  const uscita = useMutation({
    mutationFn: esci,
    onSuccess: () => {
      client.clear();
      router.replace(PERCORSI.benvenuto);
    },
  });

  const conferma = () => {
    if ((servonoTermini && !termini) || (servePrivacy && !privacy)) {
      setMancanti(true);
      return;
    }
    accetta.mutate();
  };

  return (
    <Foglio aperto chiudibile={false} onChiudi={() => undefined} titolo={testi.titolo}>
      <div className="flex flex-col gap-3.5">
        <span className="etichetta">
          {testi.aggiornamento} <span className="mono">{formattaGiorno(vigore)}</span>
        </span>
        {novita.length > 0 && (
          <ul className="elenco-novita t-corpo-s">
            {novita.map((voce) => (
              <li key={voce}>{voce}</li>
            ))}
          </ul>
        )}
        <Link
          className="link-accesso self-start"
          href={servonoTermini ? PERCORSI.termini : PERCORSI.privacy}
          target="_blank"
          rel="noreferrer"
        >
          {testi.leggi}
        </Link>
        <div>
          {servonoTermini && (
            <CasellaLunga
              selezionata={termini}
              onCambia={(valore) => {
                setTermini(valore);
                setMancanti(false);
              }}
              errore={mancanti && !termini}
            >
              {testi.accettoTermini}
            </CasellaLunga>
          )}
          {servePrivacy && (
            <CasellaLunga
              selezionata={privacy}
              onCambia={(valore) => {
                setPrivacy(valore);
                setMancanti(false);
              }}
              errore={mancanti && !privacy}
            >
              {testi.hoLettoPrivacy}
            </CasellaLunga>
          )}
          {mancanti && (
            <p className="campo-errore m-0" role="alert">
              {testi.caselleMancanti}
            </p>
          )}
        </div>
        {(accetta.isError || uscita.isError) && (
          <Avviso tipo="errore" titolo={messaggi.comune.erroreRete.titolo}>
            {messaggi.comune.erroreRete.testo}
          </Avviso>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Pulsante
            variante="secondario"
            caricamento={uscita.isPending}
            onClick={() => uscita.mutate()}
          >
            {testi.esci}
          </Pulsante>
          <Pulsante variante="secondario" caricamento={accetta.isPending} onClick={conferma}>
            {testi.accetta}
          </Pulsante>
        </div>
      </div>
    </Foglio>
  );
}
