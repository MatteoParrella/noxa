'use client';

import { Camera, Trash2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Avviso } from '@/components/ui/Avviso';
import { Campo } from '@/components/ui/Campo';
import { Pulsante } from '@/components/ui/Pulsante';
import { Caricamento } from '@/components/ui/Stati';
import { useToast } from '@/components/ui/Toast';
import {
  LUNGHEZZA_MASSIMA_NOME,
  LUNGHEZZA_MASSIMA_USERNAME,
  USERNAME,
} from '@/features/account/schemi';
import { CHIAVE_ACCOUNT, useMioAccount, useSessione } from '@/features/account/sessione';
import { useUrlAvatar } from '@/lib/avatar';
import { ErroreValidazione, type ErroreDominio } from '@/lib/errori';
import { messaggi } from '@/lib/messaggi/it';
import { aggiornaProfilo } from './api';
import { caricaAvatar, eliminaAvatar } from './api-avatar';
import { CHIAVE_MIO_AVATAR, useMioAvatar } from './dati';

/** Modifica di nome visualizzato, username e foto profilo. */
export function ModificaProfilo() {
  const sessione = useSessione();
  const account = useMioAccount(sessione);
  if (sessione.stato !== 'presente' || account.isPending || !account.data) {
    return <Caricamento descrizione={messaggi.profilo.caricamento} righe={2} />;
  }
  return (
    <>
      <SezioneAvatar io={sessione.utenteId} />
      <Modulo
        io={sessione.utenteId}
        nome={account.data.nome_visualizzato}
        username={account.data.username}
      />
    </>
  );
}

function SezioneAvatar({ io }: { io: string }) {
  const testi = messaggi.profilo;
  const mostraToast = useToast();
  const client = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [anteprimaLocale, setAnteprimaLocale] = useState<string | null>(null);

  const avatarQuery = useMioAvatar();
  const percorsoCorrente = avatarQuery.data ?? null;
  const urlSalvato = useUrlAvatar(percorsoCorrente);

  useEffect(() => {
    return () => {
      if (anteprimaLocale) URL.revokeObjectURL(anteprimaLocale);
    };
  }, [anteprimaLocale]);

  const upload = useMutation({
    mutationFn: (file: File) => caricaAvatar(io, file, percorsoCorrente),
    onSuccess: (percorso) => {
      setAnteprimaLocale(null);
      client.setQueryData([...CHIAVE_MIO_AVATAR, io], percorso);
      mostraToast({ testo: testi.fotoSuccesso });
    },
    onError: () => {
      setAnteprimaLocale(null);
      mostraToast({ testo: testi.fotoErrore });
    },
  });

  const rimuovi = useMutation({
    mutationFn: () => eliminaAvatar(io, percorsoCorrente!),
    onSuccess: () => {
      client.setQueryData([...CHIAVE_MIO_AVATAR, io], null);
      mostraToast({ testo: testi.fotoRimossaSuccesso });
    },
    onError: () => mostraToast({ testo: testi.fotoRimossaErrore }),
  });

  function onSeleziona(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (anteprimaLocale) URL.revokeObjectURL(anteprimaLocale);
    setAnteprimaLocale(URL.createObjectURL(file));
    upload.mutate(file);
    e.target.value = '';
  }

  const urlMostrato = anteprimaLocale ?? urlSalvato;
  const inCorso = upload.isPending || rimuovi.isPending;

  return (
    <div className="flex flex-col gap-3 pb-5 border-b border-linea mb-5">
      <p className="t-etichetta c-2 m-0">{testi.fotoTitolo}</p>
      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label={percorsoCorrente ? testi.fotoCambia : testi.fotoSeleziona}
          className="relative w-20 h-20 rounded-full overflow-hidden bg-superficie-2 border border-linea shrink-0 focus-visible:ring-2 focus-visible:ring-accento"
          onClick={() => inputRef.current?.click()}
          disabled={inCorso}
        >
          {urlMostrato ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={urlMostrato}
              alt=""
              className="w-full h-full object-cover"
              aria-hidden="true"
            />
          ) : (
            <Camera
              aria-hidden="true"
              className="ico ico-m c-3 absolute inset-0 m-auto"
              strokeWidth={1.5}
            />
          )}
          <span className="absolute inset-0 flex items-end justify-center pb-1 bg-gradient-to-t from-black/40 to-transparent opacity-0 hover:opacity-100 transition-opacity">
            <Camera aria-hidden="true" className="ico ico-s text-white" strokeWidth={1.5} />
          </span>
        </button>
        <div className="flex flex-col gap-2">
          <Pulsante
            variante="secondario"
            dimensione="s"
            onClick={() => inputRef.current?.click()}
            disabled={inCorso}
            caricamento={upload.isPending}
          >
            {percorsoCorrente ? testi.fotoCambia : testi.fotoSeleziona}
          </Pulsante>
          {percorsoCorrente && (
            <Pulsante
              variante="testo"
              dimensione="s"
              onClick={() => rimuovi.mutate()}
              disabled={inCorso}
              caricamento={rimuovi.isPending}
            >
              <Trash2 aria-hidden="true" className="ico ico-s" strokeWidth={1.75} />
              {testi.fotoRimuovi}
            </Pulsante>
          )}
        </div>
      </div>
      <p className="t-didascalia c-3 m-0">{testi.fotoAiuto}</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={onSeleziona}
      />
    </div>
  );
}

function Modulo({
  io,
  nome: nomeIniziale,
  username: usernameIniziale,
}: {
  io: string;
  nome: string;
  username: string;
}) {
  const testi = messaggi.profilo;
  const regole = messaggi.registrazione.profilo;
  const router = useRouter();
  const client = useQueryClient();
  const [nome, setNome] = useState(nomeIniziale);
  const [username, setUsername] = useState(usernameIniziale);
  const [errori, setErrori] = useState<{ nome?: string; username?: string }>({});

  const salvataggio = useMutation({
    mutationFn: () => aggiornaProfilo(io, { nomeVisualizzato: nome, username }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: [CHIAVE_ACCOUNT] });
      router.push('/profilo/');
    },
    onError: (errore: ErroreDominio) => {
      if (errore instanceof ErroreValidazione && errore.codice === 'valore_duplicato') {
        setErrori({ username: testi.usernameInUso });
      }
    },
  });

  const invia = (evento: FormEvent) => {
    evento.preventDefault();
    const trovati: typeof errori = {};
    if (nome.trim() === '') trovati.nome = regole.nomeMancante;
    if (username.length < 3) trovati.username = regole.usernameCorto;
    else if (!USERNAME.test(username)) trovati.username = regole.usernameCaratteri;
    setErrori(trovati);
    if (Object.keys(trovati).length === 0) salvataggio.mutate();
  };

  const erroreGenerico =
    salvataggio.isError &&
    !(
      salvataggio.error instanceof ErroreValidazione &&
      salvataggio.error.codice === 'valore_duplicato'
    );

  return (
    <form noValidate onSubmit={invia} className="flex flex-col gap-5">
      <Campo
        etichetta={regole.nome}
        autoComplete="nickname"
        maxLength={LUNGHEZZA_MASSIMA_NOME}
        conteggio={{ attuale: nome.length, massimo: LUNGHEZZA_MASSIMA_NOME }}
        value={nome}
        onChange={(evento) => {
          setNome(evento.target.value);
          setErrori(({ nome: _scarta, ...resto }) => resto);
        }}
        aiuto={testi.nomeAiuto}
        {...(errori.nome ? { errore: errori.nome } : {})}
      />
      <Campo
        etichetta={regole.username}
        autoCapitalize="none"
        spellCheck={false}
        maxLength={LUNGHEZZA_MASSIMA_USERNAME}
        conteggio={{ attuale: username.length, massimo: LUNGHEZZA_MASSIMA_USERNAME }}
        prefisso={
          <span className="prefisso" aria-hidden="true">
            @
          </span>
        }
        value={username}
        onChange={(evento) => {
          setUsername(evento.target.value.toLowerCase());
          setErrori(({ username: _scarta, ...resto }) => resto);
        }}
        aiuto={
          username === usernameIniziale
            ? `${testi.usernameAttuale}. ${regole.usernameAiuto}`
            : regole.usernameAiuto
        }
        {...(errori.username ? { errore: errori.username } : {})}
      />
      {erroreGenerico && <Avviso tipo="errore">{messaggi.amici.erroreAzione}</Avviso>}
      <Pulsante
        variante="principale"
        dimensione="l"
        pieno
        type="submit"
        caricamento={salvataggio.isPending}
        disabled={salvataggio.isPending}
      >
        {testi.salva}
      </Pulsante>
    </form>
  );
}
