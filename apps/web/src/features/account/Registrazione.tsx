'use client';

import { useMutation } from '@tanstack/react-query';
import { CircleAlert, Clock, Eye, FileText, RotateCw, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Avviso } from '@/components/ui/Avviso';
import { Campo } from '@/components/ui/Campo';
import { CampoData } from '@/components/ui/CampoData';
import { CampoPassword } from '@/components/ui/CampoPassword';
import { CasellaLunga } from '@/components/ui/CasellaLunga';
import { Icona } from '@/components/ui/Icona';
import { IndicatorePassi } from '@/components/ui/Indicatori';
import { Entra } from '@/components/ui/Movimento';
import { Pulsante } from '@/components/ui/Pulsante';
import { useOnline } from '@/lib/connessione';
import { analizzaDataNascita, dataIso, oggiARoma } from '@/lib/date';
import { ErroreLimite, ErroreRete, ErroreValidazione, type ErroreDominio } from '@/lib/errori';
import { messaggi } from '@/lib/messaggi/it';
import { registra } from './api';
import { salvaVerificaInAttesa } from './archivio';
import { PERCORSI } from './documenti';
import { EtaNonSufficiente } from './EtaNonSufficiente';
import { Schermata } from './Schermata';
import {
  LUNGHEZZA_MASSIMA_NOME,
  LUNGHEZZA_MASSIMA_USERNAME,
  LUNGHEZZA_MINIMA_PASSWORD,
  SchemaEmail,
  USERNAME,
} from './schemi';
import { useSessione } from './sessione';
import { VerificaUmana, verificaUmanaRichiesta, type ComandiVerificaUmana } from './VerificaUmana';

type Passo = 1 | 2 | 3 | 4;
const TOTALE_PASSI = 4;
const ETA_MINIMA = 14;
const ID_MODULO = 'modulo-registrazione';
const ICONE_RIASSUNTO = [FileText, Eye, Clock, Trash2] as const;

type Dati = {
  data: string;
  email: string;
  password: string;
  username: string;
  nome: string;
  termini: boolean;
  privacy: boolean;
};

const VUOTI: Dati = {
  data: '',
  email: '',
  password: '',
  username: '',
  nome: '',
  termini: false,
  privacy: false,
};

type Campi = 'data' | 'email' | 'password' | 'username' | 'nome' | 'caselle' | 'verifica';
type Errori = Partial<Record<Campi, string>>;
type ErroreGenerale = { titolo: string; testo: string; riprova: boolean } | null;

const testi = messaggi.registrazione;

/** Parte locale dell'email, per controllare che la password non la contenga. */
function contieneEmail(password: string, email: string): boolean {
  const locale = email.split('@')[0]?.toLowerCase() ?? '';
  return locale.length >= 3 && password.toLowerCase().includes(locale);
}

/** Proposta di username libero, mostrata quando quello scelto è già in uso. */
function proponiUsername(username: string): string {
  const base = username.slice(0, LUNGHEZZA_MASSIMA_USERNAME - 1);
  return `${base}2`;
}

function validaPasso(passo: Passo, dati: Dati): Errori {
  const errori: Errori = {};
  if (passo === 1) {
    const esito = analizzaDataNascita(dati.data);
    if (!esito.valida) errori.data = esito.errore;
  }
  if (passo === 2) {
    if (!SchemaEmail.safeParse(dati.email.trim()).success) {
      errori.email = testi.credenziali.emailNonValida;
    }
    if (dati.password.length < LUNGHEZZA_MINIMA_PASSWORD) {
      errori.password = testi.credenziali.passwordCorta;
    } else if (contieneEmail(dati.password, dati.email)) {
      errori.password = testi.credenziali.passwordUgualeEmail;
    }
  }
  if (passo === 3) {
    if (dati.username.length < 3) errori.username = testi.profilo.usernameCorto;
    else if (!USERNAME.test(dati.username)) errori.username = testi.profilo.usernameCaratteri;
    else if (dati.password.toLowerCase().includes(dati.username)) {
      errori.username = testi.profilo.usernameUgualePassword;
    }
    if (dati.nome.trim().length === 0) errori.nome = testi.profilo.nomeMancante;
  }
  if (passo === 4 && !(dati.termini && dati.privacy)) {
    errori.caselle = testi.consensi.caselleMancanti;
  }
  return errori;
}

/** Registrazione in 4 passi (F-10, design/F-10-accesso). La data di nascita viene per prima. */
export function Registrazione() {
  const router = useRouter();
  const sessione = useSessione();
  const online = useOnline();
  const [passo, setPasso] = useState<Passo>(1);
  const [spostato, setSpostato] = useState(false);
  const [dati, setDati] = useState<Dati>(VUOTI);
  const [errori, setErrori] = useState<Errori>({});
  const [erroreGenerale, setErroreGenerale] = useState<ErroreGenerale>(null);
  const [proposta, setProposta] = useState<string | null>(null);
  const [etaInsufficiente, setEtaInsufficiente] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const verifica = useRef<ComandiVerificaUmana>(null);
  const titolo = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (sessione.stato === 'presente') router.replace(PERCORSI.home);
  }, [sessione, router]);

  useEffect(() => {
    if (spostato) titolo.current?.focus();
  }, [passo, spostato]);

  const invio = useMutation({
    mutationFn: registra,
    onSuccess: (_risultato, variabili) => {
      salvaVerificaInAttesa({ email: variabili.email, inviataIl: Date.now() });
      router.push(PERCORSI.verifica);
    },
    onError: (errore: ErroreDominio) => {
      verifica.current?.azzera();
      gestisciErrore(errore);
    },
  });

  const aggiorna = (modifiche: Partial<Dati>) => {
    setDati((attuali) => ({ ...attuali, ...modifiche }));
    setErrori((attuali) => {
      const prossimi = { ...attuali };
      for (const campo of Object.keys(modifiche)) {
        delete prossimi[campo === 'termini' || campo === 'privacy' ? 'caselle' : (campo as Campi)];
      }
      return prossimi;
    });
  };

  const vaiAlPasso = (prossimo: Passo) => {
    setSpostato(true);
    setPasso(prossimo);
  };

  const rifiutaPerEta = () => {
    // R-01: chi ha meno di 14 anni non scrive altro e nulla resta in memoria.
    setDati(VUOTI);
    setEtaInsufficiente(true);
  };

  function gestisciErrore(errore: ErroreDominio) {
    setErroreGenerale(null);
    if (errore instanceof ErroreValidazione) {
      switch (errore.codice) {
        case 'eta_insufficiente':
          rifiutaPerEta();
          return;
        case 'data_nascita_non_valida':
          setErrori({ data: testi.data.formato });
          vaiAlPasso(1);
          return;
        case 'email_non_valida':
          setErrori({ email: testi.credenziali.emailNonValida });
          vaiAlPasso(2);
          return;
        case 'password_violata':
          setErrori({ password: testi.credenziali.passwordViolata });
          vaiAlPasso(2);
          return;
        case 'password_debole':
          setErrori({ password: testi.credenziali.passwordCorta });
          vaiAlPasso(2);
          return;
        case 'username_in_uso': {
          const nuova = proponiUsername(dati.username);
          setProposta(nuova);
          setErrori({ username: testi.profilo.usernameInUso(nuova) });
          vaiAlPasso(3);
          return;
        }
        case 'username_non_valido':
          setErrori({ username: testi.profilo.usernameCaratteri });
          vaiAlPasso(3);
          return;
        case 'nome_non_valido':
          setErrori({ nome: testi.profilo.nomeMancante });
          vaiAlPasso(3);
          return;
        case 'verifica_umana_fallita':
          setErrori({ verifica: testi.consensi.verificaUmanaFallita });
          return;
        case 'consensi_non_validi':
          setErroreGenerale({
            titolo: messaggi.comune.erroreSconosciuto.titolo,
            testo: testi.consensi.consensiCambiati,
            riprova: false,
          });
          return;
        default:
          break;
      }
    }
    if (errore instanceof ErroreRete) {
      setErroreGenerale({ ...messaggi.comune.erroreRete, riprova: true });
    } else if (errore instanceof ErroreLimite) {
      setErroreGenerale({ ...messaggi.comune.limite, riprova: false });
    } else {
      setErroreGenerale({ ...messaggi.comune.erroreSconosciuto, riprova: true });
    }
  }

  const avanti = (evento?: FormEvent) => {
    evento?.preventDefault();
    const trovati = validaPasso(passo, dati);
    if (Object.keys(trovati).length > 0) {
      setErrori(trovati);
      return;
    }
    if (passo === 1) {
      const esito = analizzaDataNascita(dati.data);
      if (esito.valida && esito.eta < ETA_MINIMA) {
        rifiutaPerEta();
        return;
      }
    }
    if (passo < TOTALE_PASSI) {
      vaiAlPasso((passo + 1) as Passo);
      return;
    }
    if (verificaUmanaRichiesta() && !token) {
      setErrori({ verifica: testi.consensi.verificaUmanaMancante });
      return;
    }
    const esito = analizzaDataNascita(dati.data);
    if (!esito.valida) {
      vaiAlPasso(1);
      return;
    }
    invio.mutate({
      email: dati.email.trim(),
      password: dati.password,
      username: dati.username,
      nomeVisualizzato: dati.nome.trim(),
      dataNascita: dataIso(esito.data),
      tokenVerificaUmana: token,
    });
  };

  if (etaInsufficiente) {
    return <EtaNonSufficiente onHoCapito={() => router.push(PERCORSI.benvenuto)} />;
  }

  const sezione = [testi.data, testi.credenziali, testi.profilo, testi.consensi][passo - 1]!;
  const dataValida = analizzaDataNascita(dati.data);
  const oggi = oggiARoma();

  const piede =
    passo === TOTALE_PASSI && !online ? (
      <>
        <Pulsante
          variante="principale"
          dimensione="l"
          pieno
          disabled
          aria-describedby="spiegazione-offline"
        >
          {testi.consensi.crea}
        </Pulsante>
        <p className="testo-piccolo text-center" id="spiegazione-offline">
          {testi.consensi.offline}
        </p>
      </>
    ) : (
      <Pulsante
        variante="principale"
        dimensione="l"
        pieno
        type="submit"
        form={ID_MODULO}
        caricamento={invio.isPending}
        disabled={invio.isPending}
      >
        {passo < TOTALE_PASSI ? (
          messaggi.comune.avanti
        ) : invio.isPending ? (
          testi.consensi.creazione
        ) : erroreGenerale?.riprova ? (
          <>
            <Icona icona={RotateCw} />
            {messaggi.comune.riprova}
          </>
        ) : (
          testi.consensi.crea
        )}
      </Pulsante>
    );

  return (
    <Schermata
      onIndietro={() =>
        passo === 1 ? router.push(PERCORSI.benvenuto) : vaiAlPasso((passo - 1) as Passo)
      }
      testa={
        <IndicatorePassi
          passo={passo}
          totale={TOTALE_PASSI}
          testo={testi.passo(passo, TOTALE_PASSI)}
          etichetta={testi.passoAccessibile(passo, TOTALE_PASSI)}
        />
      }
      testoOffline={testi.offline}
      piede={piede}
      {...(spostato ? {} : { etichetta: sezione.etichettaSezione, titolo: sezione.titolo })}
    >
      <form
        key={passo}
        id={ID_MODULO}
        noValidate
        onSubmit={avanti}
        className={spostato ? 'scorre-passo' : undefined}
      >
        {spostato && (
          <>
            <span className="etichetta">{sezione.etichettaSezione}</span>
            <h1 ref={titolo} tabIndex={-1} className="titolo-accesso">
              {sezione.titolo}
            </h1>
          </>
        )}

        {passo === 1 && (
          <Entra className="schermo-pila" indice={spostato ? 0 : 3}>
            <CampoData
              etichetta={testi.data.campo}
              valore={dati.data}
              onCambia={(data) => aggiorna({ data })}
              dataIniziale={{ anno: oggi.anno - 16, mese: 1, giorno: 1 }}
              dataScelta={dataValida.valida ? dataValida.data : undefined}
              aiuto={testi.data.aiuto}
              errore={errori.data}
            />
          </Entra>
        )}

        {passo === 2 && (
          <Entra className="schermo-pila" indice={0}>
            <Campo
              etichetta={testi.credenziali.email}
              type="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              value={dati.email}
              onChange={(evento) => aggiorna({ email: evento.target.value })}
              aiuto={testi.credenziali.emailAiuto}
              {...(errori.email ? { errore: errori.email } : {})}
            />
            <CampoPassword
              etichetta={testi.credenziali.password}
              autoComplete="new-password"
              value={dati.password}
              onChange={(evento) => aggiorna({ password: evento.target.value })}
              {...(errori.password ? { errore: errori.password } : {})}
              requisiti={[
                {
                  testo: testi.credenziali.requisitoLunghezza,
                  soddisfatto: dati.password.length >= LUNGHEZZA_MINIMA_PASSWORD,
                },
                {
                  testo: testi.credenziali.requisitoDiversa,
                  soddisfatto:
                    dati.password.length > 0 &&
                    !contieneEmail(dati.password, dati.email) &&
                    (dati.username.length < 3 ||
                      !dati.password.toLowerCase().includes(dati.username)),
                },
              ]}
            />
          </Entra>
        )}

        {passo === 3 && (
          <Entra className="schermo-pila" indice={0}>
            <Campo
              etichetta={testi.profilo.username}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={LUNGHEZZA_MASSIMA_USERNAME}
              conteggio={{ attuale: dati.username.length, massimo: LUNGHEZZA_MASSIMA_USERNAME }}
              prefisso={
                <span className="prefisso" aria-hidden="true">
                  @
                </span>
              }
              value={dati.username}
              onChange={(evento) => {
                setProposta(null);
                aggiorna({ username: evento.target.value.toLowerCase() });
              }}
              aiuto={testi.profilo.usernameAiuto}
              {...(errori.username ? { errore: errori.username } : {})}
              dopo={
                proposta && errori.username ? (
                  <Pulsante
                    variante="secondario"
                    dimensione="s"
                    className="self-start"
                    onClick={() => {
                      aggiorna({ username: proposta });
                      setProposta(null);
                    }}
                  >
                    {testi.profilo.usaProposta(proposta)}
                  </Pulsante>
                ) : undefined
              }
            />
            <Campo
              etichetta={testi.profilo.nome}
              autoComplete="nickname"
              maxLength={LUNGHEZZA_MASSIMA_NOME}
              conteggio={{ attuale: dati.nome.length, massimo: LUNGHEZZA_MASSIMA_NOME }}
              value={dati.nome}
              onChange={(evento) => aggiorna({ nome: evento.target.value })}
              aiuto={testi.profilo.nomeAiuto}
              {...(errori.nome ? { errore: errori.nome } : {})}
            />
          </Entra>
        )}

        {passo === 4 && (
          <Entra className="schermo-pila gap-4" indice={0}>
            <ul className="riassunto">
              {testi.consensi.riassunto.map((voce, indice) => (
                <li key={voce.titolo} className="riassunto-voce">
                  <Icona icona={ICONE_RIASSUNTO[indice] ?? FileText} />
                  <div>
                    <b>{voce.titolo}</b>
                    <span>{voce.testo}</span>
                  </div>
                </li>
              ))}
            </ul>
            <Link
              className="link-accesso self-start"
              href={PERCORSI.privacy}
              target="_blank"
              rel="noreferrer"
            >
              {testi.consensi.leggiInformativa}
            </Link>
            <div>
              <CasellaLunga
                selezionata={dati.termini}
                onCambia={(termini) => aggiorna({ termini })}
                errore={Boolean(errori.caselle) && !dati.termini}
              >
                {testi.consensi.accettoTermini}
                <Link
                  className="link-accesso is-in-linea"
                  href={PERCORSI.termini}
                  target="_blank"
                  rel="noreferrer"
                >
                  {testi.consensi.terminiDiServizio}
                </Link>
              </CasellaLunga>
              <CasellaLunga
                selezionata={dati.privacy}
                onCambia={(privacy) => aggiorna({ privacy })}
                errore={Boolean(errori.caselle) && !dati.privacy}
              >
                {testi.consensi.hoLettoPrivacy}
                <Link
                  className="link-accesso is-in-linea"
                  href={PERCORSI.privacy}
                  target="_blank"
                  rel="noreferrer"
                >
                  {testi.consensi.informativaPrivacy}
                </Link>
              </CasellaLunga>
              {errori.caselle && <MessaggioErrore testo={errori.caselle} />}
            </div>
            <VerificaUmana
              modalita="visibile"
              etichetta={testi.consensi.verificaUmana}
              riferimento={verifica}
              onToken={(nuovo) => {
                setToken(nuovo);
                if (nuovo) setErrori(({ verifica: _scartato, ...resto }) => resto);
              }}
            />
            {errori.verifica && <MessaggioErrore testo={errori.verifica} />}
            {erroreGenerale && (
              <Avviso tipo="errore" titolo={erroreGenerale.titolo} portaInVista>
                {erroreGenerale.testo}
              </Avviso>
            )}
          </Entra>
        )}
      </form>
    </Schermata>
  );
}

function MessaggioErrore({ testo }: { testo: string }) {
  return (
    <p
      className="campo-errore m-0"
      role="alert"
      ref={(elemento) => elemento?.scrollIntoView({ block: 'nearest' })}
    >
      <Icona icona={CircleAlert} dimensione="s" />
      <span>{testo}</span>
    </p>
  );
}
