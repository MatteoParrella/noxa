'use client';

import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Avviso } from '@/components/ui/Avviso';
import { CampoPassword } from '@/components/ui/CampoPassword';
import { Rivela } from '@/components/ui/Movimento';
import { Pulsante } from '@/components/ui/Pulsante';
import { Caricamento, ErroreConAzione } from '@/components/ui/Stati';
import { ErroreRete, ErroreValidazione, converti, type ErroreDominio } from '@/lib/errori';
import { messaggi } from '@/lib/messaggi/it';
import { impostaNuovaPassword } from './api';
import { PERCORSI } from './documenti';
import { Schermata } from './Schermata';
import { LUNGHEZZA_MINIMA_PASSWORD } from './schemi';
import { useSessione } from './sessione';
import { verificaLinkUnaVolta } from './verificaLink';

type Stato = 'verifica' | 'pronto' | 'scaduto' | 'rete';

const testi = messaggi.nuovaPassword;

/** Pagina aperta dal link di recupero (?token_hash=…&type=recovery): nuova password. */
export function NuovaPassword() {
  const router = useRouter();
  const parametri = useSearchParams();
  const sessione = useSessione();
  const tokenHash = parametri.get('token_hash');
  const [stato, setStato] = useState<Stato>('verifica');
  const [password, setPassword] = useState('');
  const [errore, setErrore] = useState<string | null>(null);
  const [uguale, setUguale] = useState(false);

  const verifica = useCallback(() => {
    if (!tokenHash) return;
    verificaLinkUnaVolta(tokenHash, 'recovery')
      .then(() => setStato('pronto'))
      .catch((motivo: unknown) => {
        setStato(converti(motivo) instanceof ErroreRete ? 'rete' : 'scaduto');
      });
  }, [tokenHash]);

  useEffect(() => {
    if (tokenHash) {
      verifica();
      return;
    }
    // Senza link: si può cambiare password solo con una sessione già aperta dal link.
    if (sessione.stato === 'assente') router.replace(PERCORSI.recupero);
  }, [tokenHash, verifica, sessione.stato, router]);

  const salvataggio = useMutation({
    mutationFn: () => impostaNuovaPassword(password),
    onSuccess: () => router.replace(PERCORSI.home),
    onError: (motivo: ErroreDominio) => {
      if (motivo instanceof ErroreValidazione && motivo.codice === 'password_uguale') {
        setUguale(true);
        setErrore(testi.uguale);
      } else if (motivo instanceof ErroreValidazione && motivo.codice === 'password_violata') {
        setErrore(messaggi.registrazione.credenziali.passwordViolata);
      } else if (motivo instanceof ErroreValidazione && motivo.codice === 'password_debole') {
        setErrore(messaggi.registrazione.credenziali.passwordCorta);
      } else if (motivo instanceof ErroreRete) {
        setErrore(messaggi.comune.erroreRete.testo);
      } else {
        setErrore(messaggi.comune.erroreSconosciuto.testo);
      }
    },
  });

  const invia = (evento: FormEvent) => {
    evento.preventDefault();
    if (password.length < LUNGHEZZA_MINIMA_PASSWORD) {
      setErrore(messaggi.registrazione.credenziali.passwordCorta);
      return;
    }
    salvataggio.mutate();
  };

  const pronto = stato === 'pronto' || (!tokenHash && sessione.stato === 'presente');

  if (!pronto) {
    return (
      <Schermata
        onIndietro={() => router.push(PERCORSI.accesso)}
        etichetta={testi.etichettaSezione}
        titolo={stato === 'scaduto' ? testi.linkScaduto.titolo : testi.titolo}
        piede={
          stato === 'scaduto' ? (
            <Link className="btn btn-l btn-principale btn-pieno" href={PERCORSI.recupero}>
              {testi.linkScaduto.azione}
            </Link>
          ) : undefined
        }
      >
        {stato === 'scaduto' && <p className="testo-accesso">{testi.linkScaduto.testo}</p>}
        {stato === 'verifica' && (
          <Caricamento descrizione={messaggi.verifica.titoloInCorso} righe={1} />
        )}
        {stato === 'rete' && (
          <ErroreConAzione
            titolo={messaggi.comune.erroreRete.titolo}
            onRiprova={() => {
              setStato('verifica');
              verifica();
            }}
          >
            {messaggi.comune.erroreRete.testo}
          </ErroreConAzione>
        )}
      </Schermata>
    );
  }

  return (
    <Schermata
      etichetta={testi.etichettaSezione}
      titolo={testi.titolo}
      piede={
        <Pulsante
          variante="principale"
          dimensione="l"
          pieno
          type="submit"
          form="modulo-nuova-password"
          caricamento={salvataggio.isPending}
          disabled={salvataggio.isPending}
        >
          {salvataggio.isPending ? testi.salvataggio : testi.salva}
        </Pulsante>
      }
    >
      <Rivela indice={2}>
        <form id="modulo-nuova-password" noValidate onSubmit={invia} className="schermo-pila">
          <CampoPassword
            etichetta={testi.campo}
            autoComplete="new-password"
            value={password}
            onChange={(evento) => {
              setPassword(evento.target.value);
              setErrore(null);
              setUguale(false);
            }}
            {...(errore ? { errore } : {})}
            requisiti={[
              {
                testo: testi.requisitoLunghezza,
                soddisfatto: password.length >= LUNGHEZZA_MINIMA_PASSWORD,
              },
              { testo: testi.requisitoDiversa, soddisfatto: password.length > 0 && !uguale },
            ]}
          />
          <p className="testo-piccolo">{testi.altriDispositivi}</p>
          {salvataggio.isError && !errore && (
            <Avviso tipo="errore">{messaggi.comune.erroreSconosciuto.testo}</Avviso>
          )}
        </form>
      </Rivela>
    </Schermata>
  );
}
