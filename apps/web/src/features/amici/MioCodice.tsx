'use client';

import { useQuery } from '@tanstack/react-query';
import { Clock, RotateCw, ScanLine, Share2, Check } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Avviso } from '@/components/ui/Avviso';
import { CodiceQr } from '@/components/ui/CodiceQr';
import { Icona } from '@/components/ui/Icona';
import { Entra } from '@/components/ui/Movimento';
import { Pulsante } from '@/components/ui/Pulsante';
import { Caricamento } from '@/components/ui/Stati';
import { useToast } from '@/components/ui/Toast';
import { useOnline } from '@/lib/connessione';
import { ErroreValidazione } from '@/lib/errori';
import { registraErrore } from '@/lib/registro';
import { messaggi } from '@/lib/messaggi/it';
import { supabase } from '@/lib/supabase';
import { creaCodice } from './api';
import { useIo } from './dati';

const testi = messaggi.codice;

/** K7Q4M2XP9H → K7Q4-M2XP-9H, più facile da leggere e dettare. */
export function formattaCodice(codice: string): string {
  return [codice.slice(0, 4), codice.slice(4, 8), codice.slice(8)].filter(Boolean).join('-');
}

/** Indirizzo del link d'invito, aperto dalla pagina di anteprima. */
export function linkInvito(codice: string): string {
  return new URL(
    `/amici/invito/?c=${encodeURIComponent(codice)}`,
    window.location.origin,
  ).toString();
}

/** Il mio codice (R-12): QR e codice scritto, validi 15 minuti, una volta sola. */
export function MioCodice() {
  const io = useIo();
  const online = useOnline();
  const [adesso, setAdesso] = useState(() => Date.now());
  const mostraToast = useToast();

  // Un codice per volta, tenuto in cache: tornando sulla pagina non se ne crea un altro.
  const codice = useQuery({
    queryKey: ['codice-invito', io],
    queryFn: creaCodice,
    enabled: io !== null && online,
    staleTime: Infinity,
    gcTime: 15 * 60_000,
    retry: false,
  });

  // Il titolare vede quando il codice è stato usato.
  const usato = useQuery({
    queryKey: ['codice-invito-usato', codice.data?.codice],
    queryFn: async () => {
      const { data, error } = await supabase()
        .from('codici_invito')
        .select('usato_il')
        .eq('codice', codice.data!.codice)
        .maybeSingle();
      if (error) throw error;
      return data?.usato_il !== null && data?.usato_il !== undefined;
    },
    enabled: Boolean(codice.data) && online,
    refetchInterval: (query) => (query.state.data ? false : 10_000),
  });

  useEffect(() => {
    const timer = window.setInterval(() => setAdesso(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const nuovo = () => {
    void codice.refetch();
  };

  const limite =
    codice.error instanceof ErroreValidazione && codice.error.codice === 'troppi_codici_oggi';

  if (!online && !codice.data) {
    return <Avviso tipo="info">{testi.offline}</Avviso>;
  }
  if (codice.isPending) return <Caricamento descrizione={testi.caricamento} righe={2} />;
  if (codice.isError) {
    return limite ? (
      <Avviso tipo="avviso" titolo={testi.limite.titolo}>
        {testi.limite.testo}
      </Avviso>
    ) : (
      <Avviso
        tipo="errore"
        titolo={testi.errore}
        azioni={
          <Pulsante variante="secondario" dimensione="s" onClick={nuovo}>
            <Icona icona={RotateCw} dimensione="s" />
            {messaggi.comune.riprova}
          </Pulsante>
        }
      >
        {messaggi.comune.erroreRete.testo}
      </Avviso>
    );
  }

  const minuti = Math.min(
    15,
    Math.ceil((new Date(codice.data.scade_il).getTime() - adesso) / 60_000),
  );
  const scaduto = minuti <= 0;
  const giaUsato = usato.data === true;
  const spento = scaduto || giaUsato;

  const condividi = async () => {
    const indirizzo = linkInvito(codice.data.codice);
    try {
      if (navigator.share) {
        await navigator.share({ text: testi.testoCondivisione, url: indirizzo });
      } else {
        await navigator.clipboard.writeText(indirizzo);
        mostraToast({ testo: testi.copiato, durata: 3000 });
      }
    } catch (errore) {
      // Condivisione annullata dall'utente: non è un errore da mostrare.
      registraErrore('condivisione del codice', errore);
    }
  };

  return (
    <div className="flex flex-col items-stretch gap-5">
      <Entra className="flex flex-col items-center gap-3" indice={1}>
        <CodiceQr
          valore={linkInvito(codice.data.codice)}
          etichetta={testi.qrAlternativa}
          spento={spento}
        >
          {spento ? (
            <>
              <Icona icona={giaUsato ? Check : Clock} dimensione="l" />
              {giaUsato ? testi.usato : testi.scaduto}
            </>
          ) : null}
        </CodiceQr>
        <p className={spento ? 'codice is-spento' : 'codice'}>
          {formattaCodice(codice.data.codice)}
        </p>
        {!spento && <p className="testo-piccolo">{testi.valido(minuti)}</p>}
        <p className="t-corpo c-2 m-0 text-center">{testi.spiegazione}</p>
      </Entra>
      {!online && <Avviso tipo="info">{testi.offline}</Avviso>}
      <div className="azioni-doppie">
        <Pulsante
          variante="secondario"
          disabled={spento || !online}
          onClick={() => void condividi()}
        >
          <Icona icona={Share2} />
          {testi.condividi}
        </Pulsante>
        <Pulsante
          variante={spento ? 'principale' : 'secondario'}
          disabled={!online || codice.isFetching}
          caricamento={codice.isFetching}
          onClick={nuovo}
        >
          <Icona icona={RotateCw} />
          {testi.nuovo}
        </Pulsante>
      </div>
      <Link className="btn btn-testo self-center" href="/amici/scansiona/">
        <Icona icona={ScanLine} />
        {testi.scansiona}
      </Link>
    </div>
  );
}
