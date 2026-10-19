'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { Info } from 'lucide-react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { Avviso } from '@/components/ui/Avviso';
import { CodiceSeiCifre } from '@/components/ui/CodiceSeiCifre';
import { Icona } from '@/components/ui/Icona';
import { Pulsante } from '@/components/ui/Pulsante';
import { Caricamento, ErroreConAzione } from '@/components/ui/Stati';
import { PERCORSI } from '@/features/account/documenti';
import { ErroreLimite, ErroreValidazione, converti } from '@/lib/errori';
import { messaggi } from '@/lib/messaggi/it';
import { avviaAttivazione, verificaCodice } from './api';

const testi = messaggi.moderazione;

/** Scheda centrata delle schermate di accesso all'area (design, tavola 01). */
export function Porta({ titolo, children }: { titolo: string; children: ReactNode }) {
  return (
    <main className="porta" id="contenuto">
      <div className="porta-scheda">
        <div className="md-marchio p-0">
          <b>noxa</b>
          <span>{testi.marchio}</span>
        </div>
        <h1 className="t-titolo-2">{titolo}</h1>
        {children}
        <p className="porta-nota">{testi.notaArea}</p>
      </div>
    </main>
  );
}

function testoErroreCodice(errore: unknown): string {
  const dominio = converti(errore);
  if (dominio instanceof ErroreLimite) return testi.accesso.troppi;
  if (dominio instanceof ErroreValidazione) {
    if (dominio.codice === 'codice_due_fattori_scaduto') return testi.accesso.scaduto;
    if (dominio.codice === 'codice_due_fattori_errato') return testi.accesso.errato;
  }
  return messaggi.comune.erroreRete.testo;
}

function CampoCodice({
  fattoreId,
  etichettaAzione,
  onVerificato,
}: {
  fattoreId: string;
  etichettaAzione: string;
  onVerificato: () => void;
}) {
  const [codice, setCodice] = useState('');
  const verifica = useMutation({
    mutationFn: (valore: string) => verificaCodice(fattoreId, valore),
    onSuccess: onVerificato,
  });
  const troppi = verifica.isError && converti(verifica.error) instanceof ErroreLimite;
  const errore = verifica.isError ? testoErroreCodice(verifica.error) : undefined;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(evento) => {
        evento.preventDefault();
        if (codice.length === 6) verifica.mutate(codice);
      }}
    >
      <CodiceSeiCifre
        etichetta={testi.accesso.codice}
        etichettaCifra={testi.accesso.cifra}
        valore={codice}
        onCambia={(valore) => {
          setCodice(valore);
          if (verifica.isError) verifica.reset();
        }}
        onCompleto={(valore) => verifica.mutate(valore)}
        errore={errore}
        disabled={troppi || verifica.isPending}
        autoFocus
      />
      <Pulsante
        type="submit"
        pieno
        caricamento={verifica.isPending}
        disabled={codice.length !== 6 || troppi}
      >
        {etichettaAzione}
      </Pulsante>
      <a className="link-accesso self-start" href={testi.accesso.emailAmministratore}>
        {testi.accesso.senzaTelefono}
      </a>
    </form>
  );
}

/** Prima volta: QR, codice segreto e primo codice per attivare i due fattori (R-06). */
export function AttivaDueFattori({ onAttivato }: { onAttivato: () => void }) {
  const nuovo = useQuery({
    // Fuori dalle chiavi 'moderazione': dopo il codice si rileggono i dati, non l'attivazione.
    queryKey: ['attivazione-due-fattori'],
    queryFn: avviaAttivazione,
    // Un'attivazione sola per visita: rifarla cambierebbe il QR già scansionato.
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const [copiato, setCopiato] = useState(false);
  const attiva = testi.accesso.attiva;

  return (
    <Porta titolo={attiva.titolo}>
      <p className="t-corpo-s c-2 m-0">{attiva.testo}</p>
      <ol className="t-corpo-s m-0 flex flex-col gap-1 pl-5">
        {attiva.passi.map((passo) => (
          <li key={passo}>{passo}</li>
        ))}
      </ol>
      {nuovo.isPending && <Caricamento descrizione={attiva.preparazione} righe={2} />}
      {nuovo.isError && (
        <ErroreConAzione
          titolo={messaggi.comune.erroreRete.titolo}
          onRiprova={() => void nuovo.refetch()}
          riprovaInCorso={nuovo.isFetching}
        >
          {messaggi.comune.erroreRete.testo}
        </ErroreConAzione>
      )}
      {nuovo.data && (
        <>
          <div className="porta-qr">
            {/* Il QR arriva da Supabase Auth come immagine SVG in un data URI. */}
            {/* eslint-disable-next-line @next/next/no-img-element -- data URI, nessuna ottimizzazione */}
            <img src={nuovo.data.qr} alt={attiva.qr} />
            <div className="flex flex-col gap-2">
              <span className="campo-etichetta">{attiva.segreto}</span>
              <div className="segreto">
                <span>{nuovo.data.segreto}</span>
                <Pulsante
                  variante="testo"
                  dimensione="s"
                  onClick={() => {
                    void navigator.clipboard
                      ?.writeText(nuovo.data.segreto)
                      .then(() => setCopiato(true));
                  }}
                >
                  {copiato ? attiva.copiato : attiva.copia}
                </Pulsante>
              </div>
            </div>
          </div>
          <CampoCodice
            fattoreId={nuovo.data.fattoreId}
            etichettaAzione={attiva.azione}
            onVerificato={onAttivato}
          />
        </>
      )}
    </Porta>
  );
}

/** Accessi successivi: il codice dell'app di autenticazione. */
export function InserisciCodice({
  fattoreId,
  scaduta,
  onVerificato,
}: {
  fattoreId: string;
  scaduta: boolean;
  onVerificato: () => void;
}) {
  const [continua, setContinua] = useState(!scaduta);
  if (!continua) {
    return (
      <Porta titolo={testi.accesso.scaduta.titolo}>
        <p className="t-corpo-s c-2 m-0">{testi.accesso.scaduta.testo}</p>
        <Pulsante pieno onClick={() => setContinua(true)}>
          {testi.accesso.scaduta.azione}
        </Pulsante>
      </Porta>
    );
  }
  return (
    <Porta titolo={testi.accesso.inserisci.titolo}>
      <p className="t-corpo-s c-2 m-0">{testi.accesso.inserisci.testo}</p>
      <CampoCodice
        fattoreId={fattoreId}
        etichettaAzione={testi.accesso.inserisci.azione}
        onVerificato={onVerificato}
      />
    </Porta>
  );
}

/** Account senza ruolo di moderatore: nessun dato dell'area, nemmeno dopo un codice. */
export function SenzaRuolo() {
  const senza = testi.accesso.senzaRuolo;
  return (
    <Porta titolo={senza.titolo}>
      <p className="t-corpo-s c-2 m-0">{senza.testo}</p>
      <Avviso tipo="info" titolo={senza.avvisoTitolo}>
        {senza.avviso}
      </Avviso>
      <Link className="btn btn-secondario" href={PERCORSI.home}>
        {senza.torna}
      </Link>
    </Porta>
  );
}

export function SenzaSessione() {
  const senza = testi.accesso.senzaSessione;
  return (
    <Porta titolo={senza.titolo}>
      <p className="t-corpo-s c-2 m-0">{senza.testo}</p>
      <Link className="btn btn-principale" href={PERCORSI.accesso}>
        <Icona icona={Info} dimensione="s" />
        {senza.azione}
      </Link>
    </Porta>
  );
}
