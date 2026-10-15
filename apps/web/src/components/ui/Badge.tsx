import type { ReactNode } from 'react';
import { classi } from '@/lib/classi';

export type VarianteBadge = 'neutro' | 'eta' | 'accento' | 'tenue' | 'avviso' | 'successo' | 'info';

type Props = {
  variante?: VarianteBadge;
  children: ReactNode;
  className?: string;
};

/** Etichetta breve. Lo stato è sempre scritto nel testo, non affidato al solo colore. */
export function Badge({ variante = 'neutro', children, className }: Props) {
  return (
    <span className={classi('badge', variante !== 'neutro' && `badge-${variante}`, className)}>
      {children}
    </span>
  );
}

type PropsContatore = {
  valore: number;
  /** Descrizione per i lettori di schermo, per esempio "3 richieste nuove". */
  descrizione: string;
};

/** Contatore neutro: mai rosso, mai lampeggiante (R-43). Oltre 99 mostra "99+". */
export function Contatore({ valore, descrizione }: PropsContatore) {
  if (valore <= 0) return null;
  return (
    <span className="contatore">
      <span aria-hidden="true">{valore > 99 ? '99+' : valore}</span>
      <span className="sr-only">{descrizione}</span>
    </span>
  );
}
