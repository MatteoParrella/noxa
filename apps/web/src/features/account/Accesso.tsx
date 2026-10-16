'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Avviso } from '@/components/ui/Avviso';
import { Campo } from '@/components/ui/Campo';
import { CampoPassword } from '@/components/ui/CampoPassword';
import { Entra } from '@/components/ui/Movimento';
import { Pulsante } from '@/components/ui/Pulsante';
import { mascheraEmail } from '@/lib/email';
import {
  ErroreAutorizzazione,
  ErroreLimite,
  ErroreRete,
  ErroreValidazione,
  type ErroreDominio,
} from '@/lib/errori';
import { messaggi } from '@/lib/messaggi/it';
import { accedi, reinviaVerifica } from './api';
import { PERCORSI } from './documenti';
import { Schermata } from './Schermata';
import { CHIAVE_ACCOUNT, useSessione } from './sessione';
import { VerificaUmana, verificaUmanaRichiesta, type ComandiVerificaUmana } from './VerificaUmana';

/** Dopo "troppi tentativi" il pulsante resta spento per un minuto (design/F-10-accesso). */
const BLOCCO_MS = 60_000;

type Esito =
  | { tipo: 'credenziali' }
  | { tipo: 'non_verificata'; email: string; reinviato: boolean }
  | { tipo: 'limite' }
  | { tipo: 'rete' }
  | { tipo: 'verifica_umana' }
  | { tipo: 'sconosciuto' }
  | null;

const testi = messaggi.accesso;

/**
 * Accesso con email e password (F-10). L'errore non dice mai se è sbagliata l'email o la
 * password; dopo troppi tentativi resta la strada del recupero.
 */
export function Accesso() {
  const router = useRouter();
  const client = useQueryClient();
  const sessione = useSessione();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mancanti, setMancanti] = useState(false);
  const [esito, setEsito] = useState<Esito>(null);
  const [bloccato, setBloccato] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const verifica = useRef<ComandiVerificaUmana>(null);

  useEffect(() => {
    if (sessione.stato === 'presente') router.replace(PERCORSI.home);
  }, [sessione, router]);

  useEffect(() => {
    if (!bloccato) return;
    const timer = window.setTimeout(() => setBloccato(false), BLOCCO_MS);
    return () => window.clearTimeout(timer);
  }, [bloccato]);

  const accesso = useMutation({
    mutationFn: () => accedi(email.trim(), password, token),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: [CHIAVE_ACCOUNT] });
      router.replace(PERCORSI.home);
    },
    onError: (errore: ErroreDominio) => {
      verifica.current?.azzera();
      if (errore instanceof ErroreAutorizzazione) {
        setEsito(
          errore.codice === 'email_non_confermata'
            ? { tipo: 'non_verificata', email: email.trim(), reinviato: false }
            : { tipo: 'credenziali' },
        );
      } else if (errore instanceof ErroreLimite) {
        setEsito({ tipo: 'limite' });
        setBloccato(true);
      } else if (errore instanceof ErroreRete) {
        setEsito({ tipo: 'rete' });
      } else if (
        errore instanceof ErroreValidazione &&
        errore.codice === 'verifica_umana_fallita'
      ) {
        setEsito({ tipo: 'verifica_umana' });
      } else {
        setEsito({ tipo: 'sconosciuto' });
      }
    },
  });

  const reinvio = useMutation({
    mutationFn: (indirizzo: string) => reinviaVerifica(indirizzo, token),
    onSuccess: (_risultato, indirizzo) =>
      setEsito({ tipo: 'non_verificata', email: indirizzo, reinviato: true }),
    onError: (errore: ErroreDominio) => {
      verifica.current?.azzera();
      setEsito(errore instanceof ErroreLimite ? { tipo: 'limite' } : { tipo: 'rete' });
    },
  });

  const invia = (evento: FormEvent) => {
    evento.preventDefault();
    if (bloccato || accesso.isPending) return;
    if (email.trim() === '' || password === '') {
      setMancanti(true);
      return;
    }
    if (verificaUmanaRichiesta() && !token) return;
    setEsito(null);
    accesso.mutate();
  };

  const erroreCredenziali =
    esito?.tipo === 'credenziali' ? testi.credenzialiErrate : mancanti ? testi.campiMancanti : null;

  return (
    <Schermata
      onIndietro={() => router.push(PERCORSI.benvenuto)}
      etichetta={testi.etichettaSezione}
      titolo={testi.titolo}
      piede={
        <>
          <Pulsante
            variante="principale"
            dimensione="l"
            pieno
            type="submit"
            form="modulo-accesso"
            caricamento={accesso.isPending}
            disabled={bloccato || accesso.isPending}
          >
            {accesso.isPending ? testi.accessoInCorso : testi.accedi}
          </Pulsante>
          <Pulsante
            variante="testo"
            className="self-center"
            onClick={() => router.push(PERCORSI.registrazione)}
          >
            {testi.creaAccount}
          </Pulsante>
        </>
      }
    >
      <Entra indice={2}>
        <form id="modulo-accesso" noValidate onSubmit={invia} className="schermo-pila">
          <Campo
            etichetta={testi.email}
            type="email"
            autoComplete="username"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(evento) => {
              setEmail(evento.target.value);
              setMancanti(false);
            }}
          />
          <CampoPassword
            etichetta={testi.password}
            autoComplete="current-password"
            value={password}
            onChange={(evento) => {
              setPassword(evento.target.value);
              setMancanti(false);
            }}
            {...(erroreCredenziali ? { errore: erroreCredenziali } : {})}
          />
          {esito?.tipo === 'non_verificata' && (
            <Avviso
              tipo="avviso"
              titolo={testi.nonVerificata.titolo}
              azioni={
                esito.reinviato ? undefined : (
                  <Pulsante
                    variante="secondario"
                    dimensione="s"
                    caricamento={reinvio.isPending}
                    onClick={() => reinvio.mutate(esito.email)}
                  >
                    {testi.nonVerificata.reinvia}
                  </Pulsante>
                )
              }
            >
              {esito.reinviato ? (
                testi.nonVerificata.reinviato
              ) : (
                <>
                  {testi.nonVerificata.testo}{' '}
                  <span className="mono">{mascheraEmail(esito.email)}</span>.
                </>
              )}
            </Avviso>
          )}
          {esito?.tipo === 'limite' && (
            <Avviso tipo="avviso" titolo={testi.troppiTentativi.titolo}>
              {testi.troppiTentativi.testo}
            </Avviso>
          )}
          {esito?.tipo === 'rete' && (
            <Avviso tipo="errore" titolo={messaggi.comune.erroreRete.titolo}>
              {messaggi.comune.erroreRete.testo}
            </Avviso>
          )}
          {esito?.tipo === 'verifica_umana' && (
            <Avviso tipo="errore">{messaggi.registrazione.consensi.verificaUmanaFallita}</Avviso>
          )}
          {esito?.tipo === 'sconosciuto' && (
            <Avviso tipo="errore" titolo={messaggi.comune.erroreSconosciuto.titolo}>
              {messaggi.comune.erroreSconosciuto.testo}
            </Avviso>
          )}
          <VerificaUmana
            modalita="discreta"
            etichetta={messaggi.registrazione.consensi.verificaUmana}
            riferimento={verifica}
            onToken={setToken}
          />
          <Pulsante
            variante="testo"
            className="-ml-3 self-start"
            onClick={() => router.push(PERCORSI.recupero)}
          >
            {testi.passwordDimenticata}
          </Pulsante>
        </form>
      </Entra>
    </Schermata>
  );
}
