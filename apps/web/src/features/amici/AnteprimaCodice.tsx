'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Avviso } from '@/components/ui/Avviso';
import { Icona } from '@/components/ui/Icona';
import { Entra } from '@/components/ui/Movimento';
import { Pulsante } from '@/components/ui/Pulsante';
import { Caricamento, ErroreConAzione } from '@/components/ui/Stati';
import { useOnline } from '@/lib/connessione';
import { messaggi } from '@/lib/messaggi/it';
import { anteprimaCodice, usaCodice } from './api';
import { CHIAVI, useIo } from './dati';
import { percorsoPersona } from './ElencoAmici';
import { estraiCodice } from './ScansionaCodice';

const testi = messaggi.anteprima;

/**
 * Anteprima di un codice invito, dal QR o dal link (R-12). Chi ha 14–17 anni vede l'avviso
 * prima di mandare una richiesta a una persona maggiorenne; l'avviso lo decide il database.
 */
export function AnteprimaCodice() {
  const io = useIo();
  const online = useOnline();
  const router = useRouter();
  const client = useQueryClient();
  const codice = estraiCodice(useSearchParams().get('c') ?? '');
  const [inviata, setInviata] = useState(false);

  const anteprima = useQuery({
    queryKey: [...CHIAVI.relazioni, 'anteprima', codice],
    queryFn: () => anteprimaCodice(codice!),
    enabled: io !== null && codice !== null && online,
  });

  const invio = useMutation({
    mutationFn: () => usaCodice(codice!),
    onSuccess: () => setInviata(true),
    onSettled: () => client.invalidateQueries({ queryKey: CHIAVI.relazioni }),
  });

  if (!online) return <Avviso tipo="info">{messaggi.codice.offline}</Avviso>;
  if (codice === null)
    return <Esito titolo={testi.nonValido.titolo} testo={testi.nonValido.testo} />;
  if (anteprima.isPending) return <Caricamento descrizione={testi.caricamento} righe={2} />;
  if (anteprima.isError) {
    return (
      <ErroreConAzione
        titolo={messaggi.comune.erroreRete.titolo}
        onRiprova={() => void anteprima.refetch()}
        riprovaInCorso={anteprima.isFetching}
      >
        {messaggi.comune.erroreRete.testo}
      </ErroreConAzione>
    );
  }

  const dati = anteprima.data;
  if (dati.stato === 'scaduto')
    return <Esito titolo={testi.scaduto.titolo} testo={testi.scaduto.testo} />;
  if (dati.stato === 'usato')
    return <Esito titolo={testi.usato.titolo} testo={testi.usato.testo} />;
  if (
    dati.stato === 'non_valido' ||
    !dati.username ||
    !dati.nome_visualizzato ||
    !dati.titolare_id
  ) {
    return <Esito titolo={testi.nonValido.titolo} testo={testi.nonValido.testo} />;
  }

  const persona = (
    <Entra className="persona-grande" indice={1}>
      <Avatar nome={dati.nome_visualizzato} dimensione="xl" decorativo />
      <p className="pg-nome">{dati.nome_visualizzato}</p>
      <p className="pg-user m-0">@{dati.username}</p>
    </Entra>
  );

  if (inviata || dati.stato === 'gia_amici' || dati.stato === 'in_attesa') {
    const messaggio = inviata
      ? testi.inviata
      : dati.stato === 'gia_amici'
        ? testi.giaAmici
        : testi.inAttesa;
    return (
      <div className="flex flex-col gap-5">
        {persona}
        <Avviso tipo={inviata ? 'successo' : 'info'}>{messaggio}</Avviso>
        <div className="flex flex-col gap-2">
          <Link className="btn btn-secondario btn-pieno" href={percorsoPersona(dati.titolare_id)}>
            {messaggi.amici.vediProfilo}
          </Link>
          <Link className="btn btn-testo self-center" href="/amici/">
            {testi.torna}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {persona}
      {dati.avviso_fasce && (
        <Avviso tipo="avviso" titolo={testi.avvisoTitolo}>
          {testi.avvisoTesto}
        </Avviso>
      )}
      {invio.isError && <Avviso tipo="errore">{messaggi.amici.erroreAzione}</Avviso>}
      <div className="azioni-doppie">
        <Pulsante variante="secondario" onClick={() => router.push('/amici/')}>
          {testi.annulla}
        </Pulsante>
        <Pulsante
          variante={dati.avviso_fasce ? 'secondario' : 'principale'}
          caricamento={invio.isPending}
          disabled={invio.isPending}
          onClick={() => invio.mutate()}
        >
          {dati.avviso_fasce && <Icona icona={ShieldAlert} />}
          {dati.avviso_fasce ? testi.hoCapitoInvia : testi.invia}
        </Pulsante>
      </div>
    </div>
  );
}

function Esito({ titolo, testo }: { titolo: string; testo: string }) {
  return (
    <div className="flex flex-col gap-4">
      <Avviso tipo="avviso" titolo={titolo}>
        {testo}
      </Avviso>
      <Link className="btn btn-secondario btn-pieno" href="/amici/scansiona/">
        {testi.altro}
      </Link>
      <Link className="btn btn-testo self-center" href="/amici/">
        {testi.torna}
      </Link>
    </div>
  );
}
