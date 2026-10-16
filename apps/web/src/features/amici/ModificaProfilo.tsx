'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Avviso } from '@/components/ui/Avviso';
import { Campo } from '@/components/ui/Campo';
import { Pulsante } from '@/components/ui/Pulsante';
import { Caricamento } from '@/components/ui/Stati';
import {
  LUNGHEZZA_MASSIMA_NOME,
  LUNGHEZZA_MASSIMA_USERNAME,
  USERNAME,
} from '@/features/account/schemi';
import { CHIAVE_ACCOUNT, useMioAccount, useSessione } from '@/features/account/sessione';
import { ErroreValidazione, type ErroreDominio } from '@/lib/errori';
import { messaggi } from '@/lib/messaggi/it';
import { aggiornaProfilo } from './api';

/** Modifica di nome visualizzato e username, con le regole della registrazione. */
export function ModificaProfilo() {
  const sessione = useSessione();
  const account = useMioAccount(sessione);
  if (sessione.stato !== 'presente' || account.isPending || !account.data) {
    return <Caricamento descrizione={messaggi.profilo.caricamento} righe={2} />;
  }
  return (
    <Modulo
      io={sessione.utenteId}
      nome={account.data.nome_visualizzato}
      username={account.data.username}
    />
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
