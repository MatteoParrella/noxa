'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Avviso } from '@/components/ui/Avviso';
import { Campo } from '@/components/ui/Campo';
import { Entra } from '@/components/ui/Movimento';
import { Pulsante } from '@/components/ui/Pulsante';
import { mascheraEmail } from '@/lib/email';
import { ErroreLimite, type ErroreDominio } from '@/lib/errori';
import { messaggi } from '@/lib/messaggi/it';
import { reinviaVerifica } from './api';
import { salvaVerificaInAttesa, useVerificaInAttesa } from './archivio';
import { PERCORSI } from './documenti';
import { IllustrazioneBusta } from './Illustrazioni';
import { Schermata } from './Schermata';
import { SchemaEmail } from './schemi';
import { useSessione } from './sessione';
import { VerificaUmana, verificaUmanaRichiesta, type ComandiVerificaUmana } from './VerificaUmana';

/** Attesa prima di poter reinviare l'email, uguale a auth.email.max_frequency di Supabase. */
const ATTESA_MS = 60_000;

const testi = messaggi.verifica;

function oraDiRoma(istante: number): string {
  return new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome',
    hour: '2-digit',
    minute: '2-digit',
  }).format(istante);
}

function secondiRimasti(inviataIl: number, adesso: number): number {
  return Math.max(0, Math.ceil((inviataIl + ATTESA_MS - adesso) / 1000));
}

function formattaAttesa(secondi: number): string {
  return `${Math.floor(secondi / 60)}:${String(secondi % 60).padStart(2, '0')}`;
}

type Props = {
  /** Il link aperto era scaduto: si chiede un nuovo link. */
  scaduto?: boolean;
};

/**
 * "Controlla la posta" dopo la registrazione e "Il link è scaduto" (design/F-10-accesso).
 * L'indirizzo è mascherato; "Reinvia l'email" resta spento per 60 secondi, con il tempo che
 * manca scritto in piccolo, senza conti alla rovescia vistosi (R-43).
 */
export function VerificaEmail({ scaduto = false }: Props) {
  const router = useRouter();
  const sessione = useSessione();
  const inAttesa = useVerificaInAttesa();
  const [adesso, setAdesso] = useState(() => Date.now());
  const [reinviataAlle, setReinviataAlle] = useState<string | null>(null);
  const [erroreInvio, setErroreInvio] = useState<'rete' | 'limite' | null>(null);
  const [emailDigitata, setEmailDigitata] = useState('');
  const [erroreEmail, setErroreEmail] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const verifica = useRef<ComandiVerificaUmana>(null);

  useEffect(() => {
    if (sessione.stato === 'presente') router.replace(PERCORSI.sicurezza);
  }, [sessione, router]);

  useEffect(() => {
    if (inAttesa === null && !scaduto) router.replace(PERCORSI.registrazione);
  }, [inAttesa, scaduto, router]);

  const rimasti = inAttesa && !scaduto ? secondiRimasti(inAttesa.inviataIl, adesso) : 0;
  useEffect(() => {
    if (rimasti === 0) return;
    const timer = window.setInterval(() => setAdesso(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [rimasti]);

  const reinvio = useMutation({
    mutationFn: (email: string) => reinviaVerifica(email, token),
    onSuccess: (_risultato, email) => {
      const dati = { email, inviataIl: Date.now() };
      salvaVerificaInAttesa(dati);
      setAdesso(dati.inviataIl);
      setReinviataAlle(oraDiRoma(dati.inviataIl));
      setErroreInvio(null);
      if (scaduto) router.replace(PERCORSI.verifica);
    },
    onError: (errore: ErroreDominio) => {
      verifica.current?.azzera();
      setReinviataAlle(null);
      setErroreInvio(errore instanceof ErroreLimite ? 'limite' : 'rete');
    },
  });

  const chiediNuovoLink = (evento?: FormEvent) => {
    evento?.preventDefault();
    const email = inAttesa?.email ?? emailDigitata.trim();
    if (!SchemaEmail.safeParse(email).success) {
      setErroreEmail(messaggi.registrazione.credenziali.emailNonValida);
      return;
    }
    if (verificaUmanaRichiesta() && !token) return;
    reinvio.mutate(email);
  };

  const emailNota = inAttesa?.email;
  const attesa = rimasti > 0 && !erroreInvio;

  return (
    <Schermata
      onIndietro={() => router.push(PERCORSI.registrazione)}
      illustrazione={<IllustrazioneBusta />}
      etichetta={testi.etichettaSezione}
      titolo={scaduto ? testi.titoloScaduto : testi.titolo}
      piede={
        <>
          {scaduto ? (
            <Pulsante
              variante="principale"
              dimensione="l"
              pieno
              type="submit"
              form="modulo-nuovo-link"
              caricamento={reinvio.isPending}
              disabled={reinvio.isPending}
            >
              {testi.nuovoLink}
            </Pulsante>
          ) : (
            <>
              <Pulsante
                variante="secondario"
                dimensione="l"
                pieno
                disabled={attesa || reinvio.isPending}
                caricamento={reinvio.isPending}
                aria-describedby={attesa ? 'attesa-reinvio' : undefined}
                onClick={() => chiediNuovoLink()}
              >
                {testi.reinvia}
              </Pulsante>
              {attesa && (
                <p className="testo-piccolo text-center" id="attesa-reinvio">
                  {testi.reinviaTra} <span className="mono">{formattaAttesa(rimasti)}</span>
                </p>
              )}
            </>
          )}
          <Pulsante
            variante="testo"
            className="self-center"
            onClick={() => router.push(PERCORSI.registrazione)}
          >
            {testi.hoSbagliato}
          </Pulsante>
        </>
      }
    >
      <Entra className="schermo-pila" indice={2}>
        {emailNota ? (
          <p className="testo-accesso">
            {testi.abbiamoMandato}{' '}
            <span className="mono text-testo-primario">{mascheraEmail(emailNota)}</span>.
          </p>
        ) : (
          <form
            id="modulo-nuovo-link"
            noValidate
            onSubmit={chiediNuovoLink}
            className="schermo-pila"
          >
            <p className="testo-accesso">{testi.scadutoSenzaEmail}</p>
            <Campo
              etichetta={testi.email}
              type="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              value={emailDigitata}
              onChange={(evento) => {
                setEmailDigitata(evento.target.value);
                setErroreEmail(null);
              }}
              {...(erroreEmail ? { errore: erroreEmail } : {})}
            />
          </form>
        )}
        {emailNota && scaduto && (
          <form id="modulo-nuovo-link" noValidate onSubmit={chiediNuovoLink} />
        )}
        {reinviataAlle && (
          <Avviso tipo="successo" titolo={testi.reinviata.titolo}>
            {testi.reinviata.testo(reinviataAlle)}
          </Avviso>
        )}
        {erroreInvio && (
          <Avviso
            tipo="errore"
            titolo={
              erroreInvio === 'limite' ? messaggi.comune.limite.titolo : testi.erroreInvio.titolo
            }
          >
            {erroreInvio === 'limite' ? messaggi.comune.limite.testo : testi.erroreInvio.testo}
          </Avviso>
        )}
        <VerificaUmana
          modalita="discreta"
          etichetta={messaggi.registrazione.consensi.verificaUmana}
          riferimento={verifica}
          onToken={setToken}
        />
      </Entra>
    </Schermata>
  );
}
