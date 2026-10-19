import { ChevronRight } from 'lucide-react';
import { classi } from '@/lib/classi';
import { GruppoAvatar } from './Avatar';
import { Icona } from './Icona';

type Props = {
  /** Primi amici da mostrare (al massimo 2 avatar più "+N"). */
  persone: Array<{ nome: string }>;
  /** Amici non mostrati negli avatar. */
  altri: number;
  /** "Marco, Sara e altri 2 ci vanno" */
  testo: string;
  /** Nel dettaglio la riga apre l'elenco degli amici. */
  onApri?: () => void;
  className?: string;
};

/**
 * Amici che partecipano (F-04): solo amici confermati che hanno reso visibile la scelta (R-67).
 * Mai nomi di sconosciuti, mai contatori di persone in generale (R-43).
 */
export function AmiciPartecipano({ persone, altri, testo, onApri, className }: Props) {
  const contenuto = (
    <>
      <GruppoAvatar persone={persone} massimo={2} altri={altri} decorativo />
      <span>{testo}</span>
    </>
  );
  if (!onApri) {
    return <span className={classi('riga-amici-part', className)}>{contenuto}</span>;
  }
  return (
    <button
      type="button"
      className={classi('riga-amici-part riga-amici-apri', className)}
      onClick={onApri}
    >
      {contenuto}
      <Icona icona={ChevronRight} dimensione="s" className="fine" />
    </button>
  );
}
