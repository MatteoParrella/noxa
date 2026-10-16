'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { Avviso } from '@/components/ui/Avviso';
import { Campo } from '@/components/ui/Campo';
import { Rivela } from '@/components/ui/Movimento';
import { Pulsante } from '@/components/ui/Pulsante';
import { ErroreLimite, ErroreRete, type ErroreDominio } from '@/lib/errori';
import { messaggi } from '@/lib/messaggi/it';
import { richiediRecupero } from './api';
import { PERCORSI } from './documenti';
import { Schermata } from './Schermata';
import { SchemaEmail } from './schemi';
import { VerificaUmana, verificaUmanaRichiesta, type ComandiVerificaUmana } from './VerificaUmana';

type Esito = 'inviato' | 'rete' | 'limite' | null;

const testi = messaggi.recupero;

/**
 * Richiesta del link per una nuova password. La risposta è la stessa che l'account esista o
 * no, così la schermata non rivela chi è registrato.
 */
export function RecuperoPassword() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [erroreEmail, setErroreEmail] = useState<string | null>(null);
  const [esito, setEsito] = useState<Esito>(null);
  const [token, setToken] = useState<string | null>(null);
  const verifica = useRef<ComandiVerificaUmana>(null);

  const richiesta = useMutation({
    mutationFn: () => richiediRecupero(email.trim(), token),
    onSuccess: () => setEsito('inviato'),
    onError: (errore: ErroreDominio) => {
      verifica.current?.azzera();
      if (errore instanceof ErroreRete) setEsito('rete');
      else if (errore instanceof ErroreLimite) setEsito('limite');
      // Ogni altro errore riceve la stessa risposta di un invio riuscito.
      else setEsito('inviato');
    },
  });

  const invia = (evento: FormEvent) => {
    evento.preventDefault();
    if (!SchemaEmail.safeParse(email.trim()).success) {
      setErroreEmail(messaggi.registrazione.credenziali.emailNonValida);
      return;
    }
    if (verificaUmanaRichiesta() && !token) return;
    richiesta.mutate();
  };

  return (
    <Schermata
      onIndietro={() => router.push(PERCORSI.accesso)}
      etichetta={testi.etichettaSezione}
      titolo={testi.titolo}
      piede={
        esito === 'inviato' ? (
          <Pulsante
            variante="secondario"
            dimensione="l"
            pieno
            onClick={() => router.push(PERCORSI.accesso)}
          >
            {testi.torna}
          </Pulsante>
        ) : (
          <Pulsante
            variante="principale"
            dimensione="l"
            pieno
            type="submit"
            form="modulo-recupero"
            caricamento={richiesta.isPending}
            disabled={richiesta.isPending}
          >
            {testi.invia}
          </Pulsante>
        )
      }
    >
      <Rivela indice={2}>
        <form id="modulo-recupero" noValidate onSubmit={invia} className="schermo-pila">
          <p className="testo-accesso">{testi.testo}</p>
          <Campo
            etichetta={testi.email}
            type="email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            readOnly={esito === 'inviato'}
            onChange={(evento) => {
              setEmail(evento.target.value);
              setErroreEmail(null);
            }}
            {...(erroreEmail ? { errore: erroreEmail } : {})}
          />
          {esito === 'inviato' && (
            <Avviso tipo="info" titolo={testi.inviato.titolo}>
              {testi.inviato.testo}
            </Avviso>
          )}
          {esito === 'rete' && (
            <Avviso tipo="errore" titolo={messaggi.comune.erroreRete.titolo}>
              {messaggi.comune.erroreRete.testo}
            </Avviso>
          )}
          {esito === 'limite' && (
            <Avviso tipo="avviso" titolo={messaggi.comune.limite.titolo}>
              {messaggi.comune.limite.testo}
            </Avviso>
          )}
          <VerificaUmana
            modalita="discreta"
            etichetta={messaggi.registrazione.consensi.verificaUmana}
            riferimento={verifica}
            onToken={setToken}
          />
        </form>
      </Rivela>
    </Schermata>
  );
}
