'use client';

import { useState } from 'react';
import { useUrlAvatar } from '@/lib/avatar';
import { classi } from '@/lib/classi';

type Persona = {
  nome: string;
  /** Percorso della foto profilo nel bucket `avatar`; senza foto restano le iniziali. */
  foto?: string | null | undefined;
};

const TINTE = ['avatar-t1', 'avatar-t2', 'avatar-t3'] as const;

/** Iniziali (al massimo due) dal nome visualizzato. */
export function iniziali(nome: string): string {
  const parole = nome.trim().split(/\s+/).filter(Boolean);
  const prima = parole[0]?.[0] ?? '';
  const seconda = parole.length > 1 ? (parole[parole.length - 1]?.[0] ?? '') : '';
  return (prima + seconda).toLocaleUpperCase('it-IT') || '?';
}

/** Tinta stabile per la stessa persona, calcolata dal nome. */
export function tinta(nome: string): (typeof TINTE)[number] {
  let somma = 0;
  for (const carattere of nome) somma = (somma + (carattere.codePointAt(0) ?? 0)) % 997;
  return TINTE[somma % TINTE.length] ?? 'avatar-t1';
}

type Props = Persona & {
  dimensione?: 's' | 'm' | 'l' | 'xl';
  /** Se l'avatar accompagna il nome scritto accanto, resta decorativo. */
  decorativo?: boolean;
};

export function Avatar({ nome, foto, dimensione = 'm', decorativo = false }: Props) {
  return (
    <span
      className={classi(
        'avatar',
        tinta(nome),
        dimensione === 's' && 'avatar-s',
        dimensione === 'l' && 'avatar-l',
        dimensione === 'xl' && 'avatar-xl',
      )}
      role={decorativo ? undefined : 'img'}
      aria-label={decorativo ? undefined : nome}
      aria-hidden={decorativo || undefined}
    >
      {foto ? <Foto percorso={foto} nome={nome} /> : iniziali(nome)}
    </span>
  );
}

/** Foto profilo; finché non è pronta, o se non si carica, restano le iniziali. */
function Foto({ percorso, nome }: { percorso: string; nome: string }) {
  const url = useUrlAvatar(percorso);
  const [urlNonCaricato, setUrlNonCaricato] = useState<string | null>(null);
  if (url === null || url === urlNonCaricato) return iniziali(nome);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="avatar-foto" src={url} alt="" onError={() => setUrlNonCaricato(url)} />
  );
}

type PropsGruppo = {
  persone: Persona[];
  massimo?: number;
  /** Altre persone oltre a quelle elencate (per esempio gli amici non mostrati). */
  altri?: number;
  /** Se i nomi sono già scritti accanto, il gruppo resta decorativo. */
  decorativo?: boolean;
};

/** Avatar sovrapposti con "+N"; l'etichetta accessibile elenca i primi nomi. */
export function GruppoAvatar({ persone, massimo = 3, altri, decorativo = false }: PropsGruppo) {
  const visibili = persone.slice(0, massimo);
  const nonMostrate = altri ?? persone.length - visibili.length;
  const nomi = visibili.map((p) => p.nome.split(' ')[0]).join(', ');
  const etichetta = nonMostrate > 0 ? `${nomi} e altre ${nonMostrate} persone` : nomi;
  return (
    <span
      className="avatar-gruppo"
      role={decorativo ? undefined : 'img'}
      aria-label={decorativo ? undefined : etichetta}
      aria-hidden={decorativo || undefined}
    >
      {visibili.map((p) => (
        <Avatar key={p.nome} nome={p.nome} foto={p.foto} dimensione="s" decorativo />
      ))}
      {nonMostrate > 0 && (
        <span className="avatar avatar-s avatar-piu" aria-hidden="true">
          +{nonMostrate}
        </span>
      )}
    </span>
  );
}
