import Link from 'next/link';
import type { ReactNode } from 'react';
import { classi } from '@/lib/classi';
import { Avatar } from './Avatar';

type Props = {
  nome: string;
  username: string;
  /** Pagina del profilo: il nome diventa un link. */
  href?: string;
  nota?: string;
  azioni?: ReactNode;
  /** Azioni sotto il nome, su due colonne uguali (Accetta / Rifiuta). */
  azioniSotto?: boolean;
};

/** Riga di una persona: avatar, nome, @username e azioni (design/F-11-amici). */
export function RigaPersona({ nome, username, href, nota, azioni, azioniSotto = false }: Props) {
  const testo = (
    <>
      <span className="rp-nome">{nome}</span>
      <span className="rp-user">@{username}</span>
      {nota && <span className="rp-nota">{nota}</span>}
    </>
  );
  return (
    <li className="riga-persona">
      <Avatar nome={nome} decorativo />
      {href ? (
        <Link className="rp-testo" href={href}>
          {testo}
        </Link>
      ) : (
        <span className="rp-testo">{testo}</span>
      )}
      {azioniSotto ? <span /> : null}
      {azioni && <div className={classi('rp-azioni', azioniSotto && 'sotto')}>{azioni}</div>}
    </li>
  );
}
