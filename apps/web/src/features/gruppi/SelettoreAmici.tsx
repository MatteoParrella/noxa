'use client';

import { Check, Lock, Search, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Avviso } from '@/components/ui/Avviso';
import { Campo } from '@/components/ui/Campo';
import { Icona } from '@/components/ui/Icona';
import { Caricamento } from '@/components/ui/Stati';
import { classi } from '@/lib/classi';
import { messaggi } from '@/lib/messaggi/it';
import { useAmiciInvitabili } from './dati';

const testi = messaggi.gruppi.selettore;

type Props = {
  /** Gruppo esistente, oppure null mentre lo si crea. */
  gruppo: string | null;
  selezionati: readonly string[];
  onCambia: (selezionati: string[]) => void;
};

/** Normalizza per la ricerca locale: minuscole e senza accenti. */
const normalizza = (testo: string) =>
  testo.toLocaleLowerCase('it').normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Selettore degli amici da invitare (design/F-13-gruppi §2): solo amici confermati, ricerca
 * locale, e chi non si può invitare resta raggiungibile ma spento con il motivo, che non dice
 * con chi c'è l'incompatibilità (R-15). Il database ricalcola i motivi a ogni selezione.
 */
export function SelettoreAmici({ gruppo, selezionati, onCambia }: Props) {
  const [testo, setTesto] = useState('');
  const amici = useAmiciInvitabili(gruppo, selezionati);

  if (amici.isPending) return <Caricamento descrizione={testi.caricamento} righe={3} />;
  if (amici.isError) return <Avviso tipo="errore">{testi.errore}</Avviso>;
  if (amici.data.length === 0) return <p className="t-corpo-s c-2 m-0">{testi.nessunAmico}</p>;

  const filtro = normalizza(testo.trim().replace(/^@/, ''));
  const visibili = amici.data.filter(
    (amico) =>
      !filtro ||
      normalizza(amico.nome_visualizzato).includes(filtro) ||
      normalizza(amico.username).includes(filtro),
  );

  const cambia = (id: string) =>
    onCambia(selezionati.includes(id) ? selezionati.filter((s) => s !== id) : [...selezionati, id]);

  return (
    <div className="flex flex-col gap-3">
      <Campo
        etichetta={testi.cerca}
        type="search"
        value={testo}
        onChange={(evento) => setTesto(evento.target.value)}
        prefisso={<Icona icona={Search} dimensione="s" />}
        autoComplete="off"
      />
      <p className="sel-regola m-0">
        <Icona icona={ShieldCheck} />
        <span>{testi.regola}</span>
      </p>
      {visibili.length === 0 ? (
        <p className="t-corpo-s c-2 m-0">{testi.nessunRisultato}</p>
      ) : (
        <ul className="m-0 list-none p-0" aria-busy={amici.isFetching || undefined}>
          {visibili.map((amico) => {
            const scelto = selezionati.includes(amico.id);
            const spento = !scelto && amico.motivo !== null;
            const idMotivo = `motivo-${amico.id}`;
            return (
              <li key={amico.id}>
                <button
                  type="button"
                  role="checkbox"
                  className="sel-riga"
                  aria-checked={scelto}
                  aria-disabled={spento || undefined}
                  aria-describedby={amico.motivo ? idMotivo : undefined}
                  onClick={() => {
                    if (!spento) cambia(amico.id);
                  }}
                >
                  <span className={classi('casella', scelto && 'is-on')} aria-hidden="true">
                    {scelto && <Icona icona={Check} dimensione="s" />}
                  </span>
                  <Avatar nome={amico.nome_visualizzato} foto={amico.avatar_path} decorativo />
                  <span className="min-w-0">
                    <span className="sel-nome">{amico.nome_visualizzato}</span>
                    <span className="sel-username">@{amico.username}</span>
                    {amico.motivo && (
                      <span className="sel-motivo" id={idMotivo}>
                        <Icona icona={Lock} />
                        {testi.motivi[amico.motivo]}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
