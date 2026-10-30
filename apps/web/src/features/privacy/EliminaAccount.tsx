'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownToLine, Check, Trash2, TriangleAlert, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Avviso } from '@/components/ui/Avviso';
import { CampoPassword } from '@/components/ui/CampoPassword';
import { CodiceSeiCifre } from '@/components/ui/CodiceSeiCifre';
import { Foglio } from '@/components/ui/Foglio';
import { Icona } from '@/components/ui/Icona';
import { TitoloRivelato } from '@/components/ui/Movimento';
import { Pulsante } from '@/components/ui/Pulsante';
import { Schermata } from '@/features/account/Schermata';
import { useIo } from '@/features/amici/dati';
import { useOnline } from '@/lib/connessione';
import { ErroreLimite, ErroreRete, ErroreValidazione } from '@/lib/errori';
import { messaggi } from '@/lib/messaggi/it';
import {
  daPulire,
  eliminaAccount,
  fattoreDueFattori,
  pulisciDispositivo,
  segnaDaPulire,
} from './api';

const testi = messaggi.privacy.elimina;

function Passi({ attuale }: { attuale: 1 | 2 }) {
  return (
    <p className="pv-passi m-0">
      <i className="fatto" aria-hidden="true" />
      <i className={attuale === 2 ? 'fatto' : undefined} aria-hidden="true" />
      {testi.passo(attuale)}
    </p>
  );
}

/**
 * Elimina l'account (design/F-42-privacy §3, R-64): due passi chiari e senza pressione. Il
 * primo dice cosa succede, il secondo chiede la password (e il codice dei due fattori, se
 * attivi). "Annulla" ha la stessa evidenza di "Elimina definitivamente" (R-43).
 */
export function EliminaAccount() {
  const router = useRouter();
  const [conferma, setConferma] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <Passi attuale={1} />
      <TitoloRivelato testo={testi.titolo} className="t-display m-0" />
      <p className="t-corpo c-2 m-0">{testi.intro}</p>

      <div className="pv-effetti">
        <section className="pv-effetto subito" aria-labelledby="pv-subito">
          <div className="pv-effetto-testa">
            <h3 id="pv-subito">{testi.spariscono}</h3>
            <span>{testi.sparisconoQuando}</span>
          </div>
          <ul>
            {testi.elenco.map((voce) => (
              <li key={voce}>
                <Icona icona={X} />
                {voce}
              </li>
            ))}
          </ul>
        </section>
        <section className="pv-effetto" aria-labelledby="pv-copie">
          <div className="pv-effetto-testa">
            <h3 id="pv-copie">{testi.copie}</h3>
            <span>{testi.copieQuando}</span>
          </div>
          <p>{testi.copieTesto}</p>
        </section>
        <section className="pv-effetto" aria-labelledby="pv-resta">
          <div className="pv-effetto-testa">
            <h3 id="pv-resta">{testi.resta}</h3>
            <span>{testi.restaQuando}</span>
          </div>
          <p>{testi.restaTesto}</p>
        </section>
      </div>

      <p className="pv-nota m-0 t-corpo">
        <Icona icona={TriangleAlert} />
        <b>{testi.irreversibile}</b>
      </p>
      <p className="pv-nota m-0">
        <Icona icona={ArrowDownToLine} />
        <span>
          {testi.primaScarica}
          <Link className="link-in-testo" href="/profilo/privacy/scarica/">
            {testi.primaScaricaLink}
          </Link>
          .
        </span>
      </p>

      <div className="pv-pari gr-barra-fondo">
        <Pulsante variante="secondario" onClick={() => router.push('/profilo/privacy/')}>
          {testi.annulla}
        </Pulsante>
        <Pulsante variante="pericolo" onClick={() => setConferma(true)}>
          {testi.continua}
        </Pulsante>
      </div>

      <Foglio aperto={conferma} onChiudi={() => setConferma(false)} titolo={testi.conferma.titolo}>
        <Conferma onAnnulla={() => setConferma(false)} />
      </Foglio>
    </div>
  );
}

function Conferma({ onAnnulla }: { onAnnulla: () => void }) {
  const io = useIo();
  const router = useRouter();
  const online = useOnline();
  const fattore = useQuery({
    queryKey: ['account', 'fattore', io ?? ''],
    queryFn: fattoreDueFattori,
    enabled: io !== null,
  });
  const [password, setPassword] = useState('');
  const [codice, setCodice] = useState('');
  const [inviato, setInviato] = useState(false);
  const [serveCodice, setServeCodice] = useState(false);
  const [passwordErrata, setPasswordErrata] = useState(false);
  const conDueFattori = serveCodice || Boolean(fattore.data);

  const elimina = useMutation({
    mutationFn: () =>
      eliminaAccount({
        password,
        ...(conDueFattori && fattore.data ? { codice, fattoreId: fattore.data } : {}),
      }),
    onSuccess: (esito) => {
      setPasswordErrata(esito === 'password_errata');
      if (esito === 'serve_codice') setServeCodice(true);
      if (esito !== 'eliminato' || !io) return;
      // La pulizia del dispositivo la fa la schermata di uscita, fuori dall'area protetta:
      // chiudere qui la sessione farebbe tornare al Benvenuto prima della conferma.
      segnaDaPulire(io);
      router.replace('/account-eliminato/');
    },
  });

  const erroreCampoPassword =
    inviato && !password
      ? testi.errori.passwordMancante
      : passwordErrata
        ? testi.errori.password
        : undefined;
  const erroreCodice =
    inviato && conDueFattori && !/^\d{6}$/.test(codice)
      ? testi.errori.codiceMancante
      : elimina.error instanceof ErroreValidazione &&
          elimina.error.codice.startsWith('codice_due_fattori')
        ? testi.errori.codice
        : undefined;

  const invia = (e: FormEvent) => {
    e.preventDefault();
    setInviato(true);
    if (!password || (conDueFattori && !/^\d{6}$/.test(codice))) return;
    elimina.mutate();
  };

  const erroreGenerale =
    elimina.error instanceof ErroreLimite
      ? { titolo: messaggi.comune.limite.titolo, testo: testi.errori.tentativi }
      : elimina.error instanceof ErroreRete
        ? testi.errori.offline
        : elimina.error && !(elimina.error instanceof ErroreValidazione)
          ? testi.errori.nonRiuscita
          : null;

  return (
    <form className="flex flex-col gap-4" onSubmit={invia} noValidate>
      <Passi attuale={2} />
      <p className="t-corpo-s c-2 m-0">
        {conDueFattori ? testi.conferma.testoDueFattori : testi.conferma.testo}
      </p>
      {!online && (
        <Avviso tipo="avviso" titolo={testi.errori.offline.titolo}>
          {testi.errori.offline.testo}
        </Avviso>
      )}
      {online && erroreGenerale && (
        <Avviso tipo="errore" titolo={erroreGenerale.titolo} portaInVista>
          {erroreGenerale.testo}
        </Avviso>
      )}
      <CampoPassword
        etichetta={testi.conferma.password}
        autoComplete="current-password"
        value={password}
        errore={erroreCampoPassword}
        onChange={(e) => {
          setPassword(e.target.value);
          setPasswordErrata(false);
        }}
      />
      {conDueFattori && (
        <CodiceSeiCifre
          etichetta={testi.conferma.codice}
          etichettaCifra={(n) => `Cifra ${n} di 6`}
          valore={codice}
          onCambia={setCodice}
          errore={erroreCodice}
        />
      )}
      <div className="flex flex-col gap-3">
        <Pulsante
          type="submit"
          variante="pericolo"
          pieno
          disabled={!online || elimina.isPending}
          caricamento={elimina.isPending}
        >
          <Icona icona={Trash2} dimensione="s" />
          {erroreGenerale ? testi.conferma.riprova : testi.conferma.elimina}
        </Pulsante>
        <Pulsante variante="secondario" pieno onClick={onAnnulla}>
          {testi.conferma.annulla}
        </Pulsante>
      </div>
    </form>
  );
}

/** Uscita dopo l'eliminazione (design/F-42-privacy §3): annunciata, con il ritorno all'inizio. */
export function AccountEliminato() {
  const fatto = testi.fatto;
  const client = useQueryClient();
  useEffect(() => {
    const io = daPulire();
    if (!io) return;
    void pulisciDispositivo(io).then(() => client.clear());
  }, [client]);
  return (
    <Schermata
      illustrazione={
        <span className="cornice-icona" aria-hidden="true">
          <Icona icona={Check} />
        </span>
      }
      titolo={fatto.titolo}
      piede={
        <Link className="btn btn-principale btn-pieno" href="/benvenuto/">
          {fatto.inizio}
        </Link>
      }
    >
      <div className="flex flex-col gap-3" role="status">
        <p className="t-corpo m-0">{fatto.testo}</p>
        <p className="t-corpo-s c-2 m-0">{fatto.saluto}</p>
      </div>
    </Schermata>
  );
}
