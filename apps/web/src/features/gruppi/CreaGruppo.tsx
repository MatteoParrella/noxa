'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Avviso } from '@/components/ui/Avviso';
import { Campo } from '@/components/ui/Campo';
import { Pulsante } from '@/components/ui/Pulsante';
import { useToast } from '@/components/ui/Toast';
import { useOnline } from '@/lib/connessione';
import { ErroreValidazione } from '@/lib/errori';
import { messaggi } from '@/lib/messaggi/it';
import { creaGruppo } from './api';
import { CHIAVI } from './dati';
import { SelettoreAmici } from './SelettoreAmici';

const testi = messaggi.gruppi;
const MASSIMO_NOME = 40;

/** Messaggio per un errore del database alla creazione o all'invito (R-15, limite di 30). */
export function erroreInviti(errore: unknown): string {
  if (errore instanceof ErroreValidazione) {
    if (errore.codice === 'gruppo_pieno') return testi.crea.errori.pieno;
    if (errore.codice === 'non_invitabile') return testi.crea.errori.nonInvitabile;
    if (errore.codice === 'troppi_gruppi_oggi') return testi.crea.errori.troppi;
  }
  return testi.crea.errori.generico;
}

/** Crea un gruppo (design/F-13-gruppi §2): nome e amici da invitare, facoltativi. */
export function CreaGruppo() {
  const router = useRouter();
  const client = useQueryClient();
  const toast = useToast();
  const online = useOnline();
  const [nome, setNome] = useState('');
  const [selezionati, setSelezionati] = useState<string[]>([]);
  const [inviato, setInviato] = useState(false);

  const pulito = nome.trim();
  const erroreNome = !inviato
    ? undefined
    : pulito === ''
      ? testi.crea.errori.nomeMancante
      : pulito.length > MASSIMO_NOME
        ? testi.crea.errori.nomeLungo
        : undefined;

  const crea = useMutation({
    mutationFn: () => creaGruppo(pulito, selezionati),
    onSuccess: (id) => {
      void client.invalidateQueries({ queryKey: CHIAVI.gruppi });
      toast({ testo: testi.crea.creato(selezionati.length) });
      router.replace(`/gruppo/?id=${id}`);
    },
  });

  const invia = (evento: FormEvent) => {
    evento.preventDefault();
    setInviato(true);
    if (pulito === '' || pulito.length > MASSIMO_NOME) return;
    crea.mutate();
  };

  const totale = 1 + selezionati.length;

  return (
    <form className="flex flex-col gap-5" onSubmit={invia} noValidate>
      <Campo
        etichetta={testi.crea.nome}
        aiuto={testi.crea.nomeAiuto}
        errore={erroreNome}
        value={nome}
        maxLength={MASSIMO_NOME}
        onChange={(evento) => setNome(evento.target.value)}
        conteggio={{ attuale: nome.length, massimo: MASSIMO_NOME }}
        autoComplete="off"
        required
      />
      <section aria-labelledby="titolo-invita" className="flex flex-col gap-2">
        <h2 className="etichetta-riga m-0" id="titolo-invita">
          {testi.crea.invita}
        </h2>
        <p className="t-corpo-s c-2 m-0">{testi.crea.invitaFacoltativo}</p>
        <SelettoreAmici gruppo={null} selezionati={selezionati} onCambia={setSelezionati} />
      </section>
      {crea.isError && (
        <Avviso tipo="errore" portaInVista>
          {erroreInviti(crea.error)}
        </Avviso>
      )}
      <div className="gr-barra-fondo">
        <span className="sel-conta" aria-live="polite">
          <span aria-hidden="true">{testi.selettore.selezionati(selezionati.length, totale)}</span>
          <span className="sr-only">
            {testi.selettore.selezionatiAccessibile(selezionati.length, totale)}
          </span>
        </span>
        <Pulsante
          type="submit"
          variante="principale"
          disabled={!online || crea.isPending}
          caricamento={crea.isPending}
        >
          {testi.crea.conferma}
        </Pulsante>
      </div>
    </form>
  );
}
