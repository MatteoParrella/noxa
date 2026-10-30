'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Flag, LockKeyhole, Pencil, ShieldCheck, Users } from 'lucide-react';
import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';
import { Contatore } from '@/components/ui/Badge';
import { Icona } from '@/components/ui/Icona';
import { Entra } from '@/components/ui/Movimento';
import { Caricamento, ErroreConAzione } from '@/components/ui/Stati';
import { ImpostazioniAspetto } from '@/features/account/ImpostazioniAspetto';
import { PulsanteEsci } from '@/features/account/PulsanteEsci';
import { useMioAccount, useSessione } from '@/features/account/sessione';
import { leggiMieiRuoli } from '@/features/moderazione/api';
import { messaggi } from '@/lib/messaggi/it';
import { useAmici, useMioAvatar } from './dati';

/** Area Profilo: chi sei per gli altri e le voci di amici, blocchi e segnalazioni. */
export function MioProfilo() {
  const testi = messaggi.profilo;
  const sessione = useSessione();
  const account = useMioAccount(sessione);
  const amici = useAmici();
  const mioAvatar = useMioAvatar();
  const richieste = amici.data?.ricevute.length ?? 0;
  const utenteId = sessione.stato === 'presente' ? sessione.utenteId : null;
  // La voce compare solo a chi ha un ruolo; l'area chiede comunque i due fattori (R-06).
  const ruoli = useQuery({
    queryKey: ['moderazione', 'ruoli', utenteId],
    queryFn: () => leggiMieiRuoli(utenteId as string),
    enabled: utenteId !== null,
  });

  if (account.isPending) return <Caricamento descrizione={testi.caricamento} righe={2} />;
  if (account.isError || !account.data) {
    return (
      <ErroreConAzione
        titolo={messaggi.comune.erroreRete.titolo}
        onRiprova={() => void account.refetch()}
        riprovaInCorso={account.isFetching}
      >
        {messaggi.comune.erroreRete.testo}
      </ErroreConAzione>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Entra className="persona-grande" indice={1}>
        <Avatar
          nome={account.data.nome_visualizzato}
          foto={mioAvatar.data}
          dimensione="xl"
          decorativo
        />
        <p className="pg-nome">{account.data.nome_visualizzato}</p>
        <p className="pg-user m-0">@{account.data.username}</p>
        <Link className="btn btn-secondario btn-s mt-2" href="/profilo/modifica/">
          <Icona icona={Pencil} dimensione="s" />
          {testi.modifica}
        </Link>
      </Entra>

      <Entra indice={2}>
        <nav aria-label={testi.account}>
          <Link className="voce-profilo" href="/amici/">
            <Icona icona={Users} />
            {testi.amici}
            <span className="valore">
              {richieste > 0 && (
                <Contatore valore={richieste} descrizione={testi.richieste(richieste)} />
              )}
              <Icona icona={ChevronRight} dimensione="s" />
            </span>
          </Link>
          <Link className="voce-profilo" href="/profilo/segnalazioni/">
            <Icona icona={Flag} />
            {testi.segnalazioni}
            <span className="valore">
              <Icona icona={ChevronRight} dimensione="s" />
            </span>
          </Link>
          <Link className="voce-profilo" href="/profilo/privacy/">
            <Icona icona={LockKeyhole} />
            <span className="flex flex-col">
              {messaggi.privacy.voce.titolo}
              <span className="t-didascalia">{messaggi.privacy.voce.testo}</span>
            </span>
            <span className="valore">
              <Icona icona={ChevronRight} dimensione="s" />
            </span>
          </Link>
          {(ruoli.data ?? []).length > 0 && (
            <Link className="voce-profilo" href="/moderazione/locali/">
              <Icona icona={ShieldCheck} />
              {testi.moderazione}
              <span className="valore">
                <Icona icona={ChevronRight} dimensione="s" />
              </span>
            </Link>
          )}
        </nav>
      </Entra>

      <Entra className="flex flex-col gap-4" indice={3}>
        <div className="etichetta-riga">
          <h2 className="etichetta m-0">{testi.aspetto}</h2>
        </div>
        <ImpostazioniAspetto />
        <PulsanteEsci />
      </Entra>
    </div>
  );
}
