'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Info, QrCode, Search } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Avviso } from '@/components/ui/Avviso';
import { Campo } from '@/components/ui/Campo';
import { Icona } from '@/components/ui/Icona';
import { Pulsante } from '@/components/ui/Pulsante';
import { RigaPersona } from '@/components/ui/RigaPersona';
import { Caricamento, ElencoVuoto, ErroreConAzione } from '@/components/ui/Stati';
import { useOnline } from '@/lib/connessione';
import { ErroreValidazione, type ErroreDominio } from '@/lib/errori';
import { messaggi } from '@/lib/messaggi/it';
import {
  cercaUtenti,
  eliminaAmicizia,
  inviaRichiesta,
  leggiAmici,
  type RisultatoRicerca,
} from './api';
import { CHIAVI, useIo } from './dati';
import { percorsoPersona } from './ElencoAmici';

const testi = messaggi.ricerca;
const ATTESA_DIGITAZIONE_MS = 300;
const MINIMO = 3;

function pulisci(testo: string): string {
  return testo.trim().replace(/^@/, '').toLowerCase();
}

/** Ricerca per username nella propria fascia (R-10): almeno 3 lettere, al massimo 20 risultati. */
export function CercaAmici() {
  const io = useIo();
  const online = useOnline();
  const client = useQueryClient();
  const [testo, setTesto] = useState('');
  const [cercato, setCercato] = useState('');
  const [limite, setLimite] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setCercato(pulisci(testo)), ATTESA_DIGITAZIONE_MS);
    return () => window.clearTimeout(timer);
  }, [testo]);

  const ricerca = useQuery({
    queryKey: [...CHIAVI.relazioni, 'ricerca', cercato],
    queryFn: () => cercaUtenti(cercato),
    enabled: io !== null && online && cercato.length >= MINIMO,
  });

  const richiesta = useMutation({
    mutationFn: async (risultato: RisultatoRicerca) => {
      await inviaRichiesta(io!, risultato.id);
    },
    onError: (errore: ErroreDominio) => {
      if (
        errore instanceof ErroreValidazione &&
        (errore.codice === 'troppe_richieste_oggi' ||
          errore.codice === 'troppe_richieste_in_attesa')
      ) {
        setLimite(true);
      }
    },
    onSettled: () => client.invalidateQueries({ queryKey: CHIAVI.relazioni }),
  });

  const annulla = useMutation({
    mutationFn: async (risultato: RisultatoRicerca) => {
      const amici = await leggiAmici(io!);
      const riga = amici.inviate.find((relazione) => relazione.persona.id === risultato.id);
      if (riga) await eliminaAmicizia(riga.amiciziaId);
    },
    onSettled: () => client.invalidateQueries({ queryKey: CHIAVI.relazioni }),
  });

  const corto = pulisci(testo).length > 0 && pulisci(testo).length < MINIMO;

  return (
    <div className="flex flex-col gap-4">
      <Campo
        etichetta={testi.campo}
        type="search"
        inputMode="text"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        autoComplete="off"
        disabled={!online}
        prefisso={
          <>
            <Icona icona={Search} />
            <span className="prefisso" aria-hidden="true">
              @
            </span>
          </>
        }
        value={testo}
        onChange={(evento) => setTesto(evento.target.value)}
        aiuto={testi.aiuto}
      />

      {!online && <Avviso tipo="info">{testi.offline}</Avviso>}
      {limite && (
        <Avviso tipo="avviso" titolo={testi.limite.titolo}>
          {testi.limite.testo}
        </Avviso>
      )}
      {richiesta.isError && !limite && <Avviso tipo="errore">{messaggi.amici.erroreAzione}</Avviso>}

      {online && corto && (
        <p className="t-corpo-s c-2 m-0 flex items-center gap-2">
          <Icona icona={Info} dimensione="s" />
          {testi.corto}
        </p>
      )}

      {online && cercato.length >= MINIMO && ricerca.isPending && (
        <Caricamento descrizione={testi.campo} righe={2} />
      )}
      {online && ricerca.isError && (
        <ErroreConAzione
          titolo={testi.errore.titolo}
          onRiprova={() => void ricerca.refetch()}
          riprovaInCorso={ricerca.isFetching}
        >
          {testi.errore.testo}
        </ErroreConAzione>
      )}
      {online && ricerca.data && ricerca.data.length === 0 && (
        <ElencoVuoto
          icona={Search}
          titolo={testi.nessuno.titolo}
          azione={
            <Link className="btn btn-secondario btn-s" href="/amici/codice/">
              <Icona icona={QrCode} dimensione="s" />
              {messaggi.amici.mioCodice}
            </Link>
          }
        >
          {testi.nessuno.testo}
        </ElencoVuoto>
      )}
      {online && ricerca.data && ricerca.data.length > 0 && (
        <section aria-live="polite" aria-label={testi.risultati(ricerca.data.length)}>
          <ul className="m-0 list-none p-0">
            {ricerca.data.map((risultato) => (
              <RigaPersona
                key={risultato.id}
                nome={risultato.nome_visualizzato}
                username={risultato.username}
                {...(risultato.relazione !== 'nessuna'
                  ? { href: percorsoPersona(risultato.id) }
                  : {})}
                azioni={
                  <AzioneRisultato
                    risultato={risultato}
                    occupato={richiesta.isPending || annulla.isPending}
                    onAggiungi={() => richiesta.mutate(risultato)}
                    onAnnulla={() => annulla.mutate(risultato)}
                  />
                }
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function AzioneRisultato({
  risultato,
  occupato,
  onAggiungi,
  onAnnulla,
}: {
  risultato: RisultatoRicerca;
  occupato: boolean;
  onAggiungi: () => void;
  onAnnulla: () => void;
}) {
  const testiAmici = messaggi.amici;
  if (risultato.relazione === 'amici')
    return <span className="inviata">{testiAmici.giaAmici}</span>;
  if (risultato.relazione === 'ricevuta') {
    return (
      <Link className="btn btn-s btn-secondario" href={percorsoPersona(risultato.id)}>
        {testiAmici.vediProfilo}
      </Link>
    );
  }
  if (risultato.relazione === 'inviata') {
    return (
      <>
        <span className="inviata">{testiAmici.richiestaInviata}</span>
        <Pulsante variante="testo" dimensione="s" disabled={occupato} onClick={onAnnulla}>
          {testiAmici.annulla}
        </Pulsante>
      </>
    );
  }
  return (
    <Pulsante variante="secondario" dimensione="s" disabled={occupato} onClick={onAggiungi}>
      {testiAmici.aggiungi}
    </Pulsante>
  );
}
