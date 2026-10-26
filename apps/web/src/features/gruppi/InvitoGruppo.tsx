'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Info } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Avatar, GruppoAvatar } from '@/components/ui/Avatar';
import { Avviso } from '@/components/ui/Avviso';
import { Foglio } from '@/components/ui/Foglio';
import { Icona } from '@/components/ui/Icona';
import { Pulsante } from '@/components/ui/Pulsante';
import { RigaPersona } from '@/components/ui/RigaPersona';
import { Caricamento } from '@/components/ui/Stati';
import { useToast } from '@/components/ui/Toast';
import { useOnline } from '@/lib/connessione';
import { messaggi } from '@/lib/messaggi/it';
import { accettaInvito, togliDalGruppo, type GruppoElenco } from './api';
import { CHIAVI, useAnteprimaInvito } from './dati';

const testi = messaggi.gruppi.invito;

type Props = { io: string; invito: GruppoElenco };

/**
 * Invito ricevuto (R-11): si accetta o si rifiuta esplicitamente; "Vedi chi c'è" apre
 * l'anteprima con le sole persone che si conoscono già (R-13).
 */
export function VoceInvito({ io, invito }: Props) {
  const online = useOnline();
  const client = useQueryClient();
  const toast = useToast();
  const [aperto, setAperto] = useState(false);
  const chi = invito.invitato_da?.nome_visualizzato;

  const risposta = useMutation({
    mutationFn: (accetta: boolean) =>
      accetta ? accettaInvito(io, invito.id) : togliDalGruppo(invito.id, io),
    onSuccess: (_esito, accetta) => {
      setAperto(false);
      toast({ testo: accetta ? testi.accettato(invito.nome) : testi.rifiutato });
    },
    onSettled: () => client.invalidateQueries({ queryKey: CHIAVI.gruppi }),
  });

  const azioni = (
    <div className="azioni-doppie">
      <Pulsante
        variante="secondario"
        disabled={!online || risposta.isPending}
        onClick={() => risposta.mutate(false)}
      >
        {testi.rifiuta}
      </Pulsante>
      <Pulsante
        variante="secondario"
        disabled={!online || risposta.isPending}
        caricamento={risposta.isPending && risposta.variables === true}
        onClick={() => risposta.mutate(true)}
      >
        {testi.accetta}
      </Pulsante>
    </div>
  );

  return (
    <li className="inv-voce">
      <div className="inv-testa">
        <Avatar nome={chi ?? invito.nome} foto={invito.invitato_da?.avatar_path} decorativo />
        <span>
          {chi ? testi.voce(chi, invito.nome) : testi.voceAnonima(invito.nome)}
          {invito.membri !== null && (
            <span className="gr-conteggio"> · {messaggi.gruppi.elenco.membri(invito.membri)}</span>
          )}
        </span>
      </div>
      <Pulsante
        variante="testo"
        dimensione="s"
        className="self-start"
        onClick={() => setAperto(true)}
      >
        {testi.dettagli}
      </Pulsante>
      {risposta.isError && <Avviso tipo="errore">{messaggi.gruppi.dettaglio.erroreAzione}</Avviso>}
      {azioni}
      {aperto && (
        <FoglioInvito
          gruppo={invito.id}
          nome={invito.nome}
          azioni={azioni}
          onChiudi={() => setAperto(false)}
        />
      )}
    </li>
  );
}

function FoglioInvito({
  gruppo,
  nome,
  azioni,
  onChiudi,
}: {
  gruppo: string;
  nome: string;
  azioni: ReactNode;
  onChiudi: () => void;
}) {
  const anteprima = useAnteprimaInvito(gruppo);
  return (
    <Foglio aperto titolo={testi.titolo(nome)} onChiudi={onChiudi}>
      {anteprima.isPending ? (
        <Caricamento descrizione={testi.caricamento} righe={2} />
      ) : anteprima.isError || anteprima.data.stato === 'non_valido' ? (
        <Avviso tipo="info" titolo={testi.nonValido.titolo}>
          {testi.nonValido.testo}
        </Avviso>
      ) : (
        <div className="flex flex-col gap-4">
          {anteprima.data.invitato_da && (
            <section aria-labelledby="invito-chi">
              <h3 className="etichetta m-0" id="invito-chi">
                {testi.chiTiInvita}
              </h3>
              <ul className="m-0 list-none p-0">
                <RigaPersona
                  nome={anteprima.data.invitato_da.nome_visualizzato}
                  username={anteprima.data.invitato_da.username}
                  foto={anteprima.data.invitato_da.avatar_path}
                />
              </ul>
            </section>
          )}
          <section aria-labelledby="invito-conosci">
            <h3 className="etichetta m-0" id="invito-conosci">
              {testi.conosci}
            </h3>
            {anteprima.data.conosciuti.length === 0 ? (
              <p className="t-corpo-s c-2 m-0">{testi.nessunoConosciuto}</p>
            ) : (
              <div className="flex items-center gap-3 pt-2">
                <GruppoAvatar
                  persone={anteprima.data.conosciuti.map((p) => ({
                    nome: p.nome_visualizzato,
                    foto: p.avatar_path,
                  }))}
                  massimo={4}
                  altri={0}
                />
                <span className="t-corpo-s">
                  {anteprima.data.conosciuti.map((p) => p.nome_visualizzato).join(', ')}
                </span>
              </div>
            )}
            {(anteprima.data.altri ?? 0) > 0 && (
              <p className="t-corpo-s c-2 m-0 pt-2">{testi.altri(anteprima.data.altri ?? 0)}</p>
            )}
          </section>
          <p className="gr-effetto m-0">
            <Icona icona={Info} dimensione="s" />
            <span>{testi.spiegazione}</span>
          </p>
          {azioni}
          <p className="t-didascalia c-2 m-0">{testi.rifiutaTesto}</p>
        </div>
      )}
    </Foglio>
  );
}
